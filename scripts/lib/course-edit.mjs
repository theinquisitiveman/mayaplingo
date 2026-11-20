// Shared by apply-corrections (exported files) and publish-account (a signed-in account):
// fold learners' fixes and recordings into content/course.json + public/audio/ for everyone.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const COURSE = new URL('../../content/course.json', import.meta.url)
const AUDIO_DIR = new URL('../../public/audio/', import.meta.url)
const EXT = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav' }

/**
 * @param {Array<{itemId: string, fields?: object, alts?: string[], by?: string, updatedAt: number,
 *   audio?: {bytes: Buffer, mime: string}}>} corrections
 * @param {{dryRun?: boolean}} opts
 */
export function applyToCourse(corrections, { dryRun = false } = {}) {
  const course = JSON.parse(readFileSync(COURSE, 'utf8'))
  const byId = new Map(course.units.flatMap((u) => u.lessons.flatMap((l) => l.items)).map((i) => [i.id, i]))
  const contributors = new Set(course.contributors ?? [])
  if (!dryRun) mkdirSync(AUDIO_DIR, { recursive: true })
  let applied = 0, withAudio = 0
  // Oldest first, so the newest edit of an item wins.
  for (const c of [...corrections].sort((a, b) => a.updatedAt - b.updatedAt)) {
    const item = byId.get(c.itemId)
    if (!item) { console.warn(`skip unknown item ${c.itemId}`); continue }
    const before = item.roman
    Object.assign(item, c.fields ?? {})
    if (c.alts?.length) item.alts = [...new Set([...(item.alts ?? []), ...c.alts])]
    if (c.audio) {
      const mime = c.audio.mime.split(';')[0].trim()
      const rel = `audio/${item.id}.${EXT[mime] ?? 'm4a'}`
      if (!dryRun) {
        // A re-recording may change format: remove this item's older file(s) first.
        for (const f of readdirSync(AUDIO_DIR)) if (f.startsWith(`${item.id}.`)) rmSync(new URL(f, AUDIO_DIR))
        writeFileSync(new URL(rel.slice('audio/'.length), AUDIO_DIR), c.audio.bytes)
      }
      item.audio = rel
      withAudio++
    }
    item.status = 'reviewed'
    if (c.by) contributors.add(c.by)
    applied++
    const changed = Object.keys(c.fields ?? {})
    console.log(`✓ ${item.id}: ${before}${before !== item.roman ? ` → ${item.roman}` : ''}${changed.length ? ` [${changed.join(', ')}]` : ''}${c.audio ? ' (+audio)' : ''}`)
  }
  if (contributors.size) course.contributors = [...contributors].sort()
  if (!dryRun) writeFileSync(COURSE, JSON.stringify(course, null, 2) + '\n')
  return { applied, withAudio }
}
