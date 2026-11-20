import { clear, createStore, del, get, keys, set } from 'idb-keyval'
import type { Corrections } from './types'
import { emptyProgress, type Progress } from './progress'

export interface Settings {
  reviewerName: string
}
export const defaultSettings: Settings = { reviewerName: '' }

// Distinct names: DariLingo runs on the same origin (theinquisitiveman.github.io), so storage must not collide.
const store = createStore('mayaplingo', 'kv')
const audioStore = createStore('mayaplingo-audio', 'recordings')

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    return { ...fallback, ...((await get(key, store)) ?? {}) }
  } catch {
    return fallback
  }
}

export const loadProgress = () => safeGet<Progress>('progress', emptyProgress())
export const saveProgress = (p: Progress) => set('progress', p, store)
export const loadSettings = () => safeGet<Settings>('settings', defaultSettings)
export const saveSettings = (s: Settings) => set('settings', s, store)
export const loadCorrections = () => safeGet<Corrections>('corrections', {})
export const saveCorrections = (c: Corrections) => set('corrections', c, store)

export const getRecording = (itemId: string) => get<Blob>(itemId, audioStore)
export const putRecording = (itemId: string, blob: Blob) => set(itemId, blob, audioStore)
export const deleteRecording = (itemId: string) => del(itemId, audioStore)
export const recordingIds = async () => new Set((await keys(audioStore)).map(String))

/** Wipe everything on this device (used on sign-out and account deletion, so a shared phone keeps nothing). */
export const clearAll = () => Promise.all([clear(store), clear(audioStore)])
