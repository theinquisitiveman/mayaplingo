import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import baseCourse from '../content/course.json'
import { allItems, applyCorrections } from './lib/content'
import { blobToDataUrl, dataUrlToBlob, mergeCorrections, parseCorrectionsFile, type CorrectionsFile } from './lib/corrections'
import * as db from './lib/db'
import { emptyProgress, type Progress } from './lib/progress'
import { stableJson } from './lib/stableJson'
import { supabase } from './lib/supabase'
import * as sync from './lib/sync'
import type { Correction, Corrections, Course, Item, LiveItem } from './lib/types'

const BASE = baseCourse as Course
const KNOWN_IDS = new Set(allItems(BASE).map((i) => i.id))
const ORIGINALS = new Map(allItems(BASE).map((i) => [i.id, i]))

type Fields = Correction['fields']
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'error'

interface AppState {
  ready: boolean
  course: Course
  item: (id: string) => LiveItem
  original: (id: string) => Item | undefined
  progress: Progress
  setProgress: (fn: (p: Progress) => Progress) => void
  settings: db.Settings
  updateSettings: (s: Partial<db.Settings>) => void
  /** Active corrections (resets excluded). */
  corrections: Corrections
  recordings: Set<string>
  canListen: (item: LiveItem) => boolean
  /** audio: Blob = new recording, null = remove recording, undefined = leave as is. */
  saveCorrection: (itemId: string, fields: Fields, alts: string[], audio?: Blob | null) => Promise<void>
  acceptAnswer: (itemId: string, answer: string) => void
  resetCorrection: (itemId: string) => Promise<void>
  exportCorrections: () => Promise<File>
  importCorrections: (text: string) => Promise<number>
  // Accounts (null/false when the build has no Supabase project configured)
  accountsEnabled: boolean
  email: string | null
  syncStatus: SyncStatus
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

/** Keep only fields that actually differ from the bundled content. */
function diffFields(itemId: string, fields: Fields): Fields {
  const orig = ORIGINALS.get(itemId)!
  const out: Fields = {}
  for (const k of ['roman', 'en', 'notes'] as const) {
    const v = fields[k]?.trim()
    if (v !== undefined && v !== (orig[k] ?? '')) out[k] = v
  }
  return out
}

const tombstone = (itemId: string): Correction => ({ itemId, fields: {}, deleted: true, updatedAt: Date.now() })

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [progress, setProgressState] = useState<Progress>(emptyProgress())
  const [settings, setSettings] = useState(db.defaultSettings)
  const [corrections, setCorrections] = useState<Corrections>({})
  const [recordings, setRecordings] = useState<Set<string>>(new Set())
  const [session, setSession] = useState<Session | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const userId = session?.user.id ?? null

  useEffect(() => {
    Promise.all([db.loadProgress(), db.loadSettings(), db.loadCorrections(), db.recordingIds().catch(() => new Set<string>())])
      .then(([p, s, c, r]) => {
        setProgressState(p)
        setSettings(s)
        setCorrections(c)
        setRecordings(r)
      })
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (ready) db.saveProgress(progress).catch(console.error) }, [ready, progress])
  useEffect(() => { if (ready) db.saveSettings(settings).catch(console.error) }, [ready, settings])
  useEffect(() => { if (ready) db.saveCorrections(corrections).catch(console.error) }, [ready, corrections])

  // ---- Account sync: pull, merge, apply locally, push. Safe to call any time; calls are serialized.
  const latest = useRef({ progress, settings, corrections })
  latest.current = { progress, settings, corrections }
  const running = useRef(false)
  const again = useRef(false)

  const syncNow = useCallback(async (): Promise<void> => {
    if (!supabase || !userId) return
    if (running.current) { again.current = true; return }
    running.current = true
    setSyncStatus('syncing')
    try {
      const remote = await sync.pullState(supabase, userId)
      const local = latest.current
      const merged = sync.mergeState(local, remote, KNOWN_IDS)
      if (stableJson(merged.progress) !== stableJson(local.progress)) setProgressState(merged.progress)
      if (stableJson(merged.settings) !== stableJson(local.settings)) setSettings(merged.settings)
      if (stableJson(merged.corrections) !== stableJson(local.corrections)) setCorrections(merged.corrections)
      if (stableJson(merged) !== stableJson(remote)) await sync.pushState(supabase, userId, merged)

      // Recordings: upload what's only here, download what's only in the account, drop what's no longer used.
      const wanted = new Set(Object.values(merged.corrections).filter((c) => c.hasAudio && !c.deleted).map((c) => c.itemId))
      const [remoteRecs, localRecs] = await Promise.all([sync.listRemoteRecordings(supabase, userId), db.recordingIds()])
      for (const id of wanted) {
        if (localRecs.has(id) && !remoteRecs.has(id)) await sync.uploadRecording(supabase, userId, id, (await db.getRecording(id))!)
        if (!localRecs.has(id) && remoteRecs.has(id)) await db.putRecording(id, await sync.downloadRecording(supabase, userId, id))
      }
      // Only delete recordings the user explicitly removed, judged on the freshest state, so a recording
      // saved while this sync was in flight is never thrown away.
      const removed = (id: string) => {
        const c = latest.current.corrections[id]
        return !!c && (c.deleted || c.hasAudio === false)
      }
      await sync.removeRecordings(supabase, userId, [...remoteRecs].filter(removed))
      for (const id of localRecs) if (removed(id)) await db.deleteRecording(id)
      setRecordings(await db.recordingIds())
      setSyncStatus('saved')
    } catch (e) {
      console.error('sync failed', e)
      setSyncStatus(navigator.onLine ? 'error' : 'offline')
    } finally {
      running.current = false
      if (again.current) { again.current = false; void syncNow() }
    }
  }, [userId])

  // Sync on sign-in, shortly after any change, when the app comes back to the foreground, and when back online.
  useEffect(() => { if (ready && userId) void syncNow() }, [ready, userId, syncNow])
  useEffect(() => {
    if (!ready || !userId) return
    const t = setTimeout(() => void syncNow(), 1500)
    return () => clearTimeout(t)
  }, [ready, userId, progress, settings, corrections, syncNow])
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void syncNow()
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline) }
  }, [syncNow])

  async function wipeDevice() {
    await db.clearAll()
    setProgressState(emptyProgress())
    setSettings(db.defaultSettings)
    setCorrections({})
    setRecordings(new Set())
    setSyncStatus('idle')
  }

  const sendCode = useCallback(async (email: string) => {
    const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    if (error) throw error
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await syncNow() // don't lose the last few answers
    await supabase!.auth.signOut()
    await wipeDevice()
  }, [syncNow])

  const deleteAccount = useCallback(async () => {
    const sb = supabase!
    if (!userId) return
    await sync.removeRecordings(sb, userId, [...(await sync.listRemoteRecordings(sb, userId))])
    const { error } = await sb.rpc('delete_my_account')
    if (error) throw error
    await sb.auth.signOut({ scope: 'local' })
    await wipeDevice()
  }, [userId])

  // ---- Corrections
  const active = useMemo(() => Object.fromEntries(Object.entries(corrections).filter(([, c]) => !c.deleted)), [corrections])
  const course = useMemo(() => applyCorrections(BASE, corrections), [corrections])
  const byId = useMemo(() => new Map(allItems(course).map((i) => [i.id, i])), [course])

  const setProgress = useCallback((fn: (p: Progress) => Progress) => setProgressState(fn), [])

  const saveCorrection = useCallback<AppState['saveCorrection']>(async (itemId, fields, alts, audio) => {
    if (audio) await db.putRecording(itemId, audio)
    if (audio === null) await db.deleteRecording(itemId)
    const hasAudio = audio === undefined ? recordings.has(itemId) : !!audio
    setRecordings((prev) => {
      const next = new Set(prev)
      if (hasAudio) next.add(itemId)
      else next.delete(itemId)
      return next
    })
    // Upload a new recording right away; if that fails, the next sync retries.
    if (audio && supabase && userId) sync.uploadRecording(supabase, userId, itemId, audio).catch(console.error)
    const changed = diffFields(itemId, fields)
    const cleanAlts = [...new Set(alts.map((a) => a.trim()).filter(Boolean))]
    setCorrections((prev) => ({
      ...prev,
      [itemId]: !Object.keys(changed).length && !cleanAlts.length && !hasAudio
        ? tombstone(itemId)
        : { itemId, fields: changed, alts: cleanAlts, hasAudio, by: settings.reviewerName || undefined, updatedAt: Date.now() },
    }))
  }, [recordings, settings.reviewerName, userId])

  const acceptAnswer = useCallback((itemId: string, answer: string) => {
    setCorrections((prev) => {
      const old = prev[itemId]
      const c = old && !old.deleted ? old : { itemId, fields: {}, updatedAt: 0 }
      return { ...prev, [itemId]: { ...c, alts: [...new Set([...(c.alts ?? []), answer])], by: settings.reviewerName || c.by, updatedAt: Date.now() } }
    })
  }, [settings.reviewerName])

  const resetCorrection = useCallback(async (itemId: string) => {
    await db.deleteRecording(itemId)
    setRecordings((prev) => { const n = new Set(prev); n.delete(itemId); return n })
    setCorrections((prev) => ({ ...prev, [itemId]: tombstone(itemId) }))
  }, [])

  const exportCorrections = useCallback(async () => {
    const list = await Promise.all(
      Object.values(active).map(async (c) => {
        const blob = c.hasAudio ? await db.getRecording(c.itemId) : undefined
        return { ...c, audioDataUrl: blob ? await blobToDataUrl(blob) : undefined }
      }),
    )
    const file: CorrectionsFile = {
      format: 'mayaplingo-corrections', version: 1, exportedAt: new Date().toISOString(),
      by: settings.reviewerName || undefined, corrections: list,
    }
    const stamp = new Date().toISOString().slice(0, 10)
    return new File([JSON.stringify(file, null, 2)], `mayaplingo-corrections-${stamp}.json`, { type: 'application/json' })
  }, [active, settings.reviewerName])

  const importCorrections = useCallback(async (text: string) => {
    const file = parseCorrectionsFile(text)
    const merged = mergeCorrections(corrections, file.corrections, KNOWN_IDS)
    const applied = file.corrections.filter((c) => merged[c.itemId]?.updatedAt === c.updatedAt)
    for (const c of applied) {
      if (c.audioDataUrl) await db.putRecording(c.itemId, await dataUrlToBlob(c.audioDataUrl))
    }
    setRecordings(await db.recordingIds())
    setCorrections(merged)
    return applied.length
  }, [corrections])

  const value: AppState = {
    ready, course,
    item: (id) => byId.get(id)!,
    original: (id) => ORIGINALS.get(id),
    progress, setProgress,
    settings, updateSettings: (s) => setSettings((prev) => ({ ...prev, ...s })),
    corrections: active, recordings,
    canListen: (it) => recordings.has(it.id) || !!it.audio,
    saveCorrection, acceptAnswer, resetCorrection, exportCorrections, importCorrections,
    accountsEnabled: !!supabase,
    email: session?.user.email ?? null,
    syncStatus, sendCode, verifyCode, signOut, deleteAccount,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
