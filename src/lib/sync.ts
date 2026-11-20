import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeCorrections } from './corrections'
import type { Settings } from './db'
import type { Progress } from './progress'
import type { Corrections } from './types'

export interface SyncedState { progress: Progress; settings: Settings; corrections: Corrections }

/**
 * Combine two copies of a learner's progress (this device + their account) without losing work:
 * the further-along value wins for totals, the most recent answer wins per phrase.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const completed = { ...a.completed }
  for (const [id, n] of Object.entries(b.completed)) completed[id] = Math.max(completed[id] ?? 0, n)
  const srs = { ...a.srs }
  for (const [id, s] of Object.entries(b.srs)) if (!srs[id] || (s.at ?? 0) > (srs[id].at ?? 0)) srs[id] = s
  const later = <T extends { lastDay?: string | null; day?: string | null }>(x: T, y: T, key: 'lastDay' | 'day', n: (t: T) => number) => {
    const dx = x[key] ?? '', dy = y[key] ?? ''
    return dx === dy ? (n(x) >= n(y) ? x : y) : dx > dy ? x : y
  }
  return {
    xp: Math.max(a.xp, b.xp),
    streak: later(a.streak, b.streak, 'lastDay', (s) => s.count),
    daily: later(a.daily, b.daily, 'day', (d) => d.xp),
    hearts: a.hearts.count <= b.hearts.count ? a.hearts : b.hearts,
    completed,
    srs,
  }
}

export function mergeState(local: SyncedState, remote: Partial<SyncedState> | null, knownIds: Set<string>): SyncedState {
  if (!remote) return local
  return {
    progress: remote.progress && 'xp' in remote.progress ? mergeProgress(local.progress, remote.progress) : local.progress,
    settings: { ...local.settings, ...(remote.settings ?? {}) },
    corrections: mergeCorrections(local.corrections, Object.values(remote.corrections ?? {}), knownIds),
  }
}

export async function pullState(sb: SupabaseClient, userId: string): Promise<Partial<SyncedState> | null> {
  const { data, error } = await sb.from('user_state').select('progress, settings, corrections').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function pushState(sb: SupabaseClient, userId: string, s: SyncedState) {
  const { error } = await sb.from('user_state').upsert({ user_id: userId, ...s })
  if (error) throw error
}

const recPath = (userId: string, itemId: string) => `${userId}/${itemId}`

export async function listRemoteRecordings(sb: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await sb.storage.from('recordings').list(userId, { limit: 1000 })
  if (error) throw error
  return new Set(data.map((f) => f.name))
}

export async function uploadRecording(sb: SupabaseClient, userId: string, itemId: string, blob: Blob) {
  const { error } = await sb.storage.from('recordings').upload(recPath(userId, itemId), blob, {
    upsert: true,
    contentType: blob.type.split(';')[0] || 'audio/mp4',
  })
  if (error) throw error
}

export async function downloadRecording(sb: SupabaseClient, userId: string, itemId: string): Promise<Blob> {
  const { data, error } = await sb.storage.from('recordings').download(recPath(userId, itemId))
  if (error) throw error
  return data
}

export async function removeRecordings(sb: SupabaseClient, userId: string, itemIds: string[]) {
  if (!itemIds.length) return
  const { error } = await sb.storage.from('recordings').remove(itemIds.map((id) => recPath(userId, id)))
  if (error) throw error
}
