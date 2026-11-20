import { getRecording } from './db'
import type { LiveItem } from './types'

let current: HTMLAudioElement | null = null

export function playUrl(url: string) {
  current?.pause()
  current = new Audio(url)
  return current.play()
}

/**
 * Play the best available pronunciation: the user's own correction recording,
 * then a bundled native recording.
 * Returns false if nothing could be played.
 */
export async function playItem(item: LiveItem): Promise<boolean> {
  const rec = await getRecording(item.id).catch(() => undefined)
  if (rec) {
    const url = URL.createObjectURL(rec)
    await playUrl(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 30_000))
    return true
  }
  if (item.audio) {
    // Fetch the whole file (rather than letting <audio> make range requests) so the service worker can
    // cache it for offline use.
    const res = await fetch(import.meta.env.BASE_URL + item.audio)
    if (!res.ok) throw new Error(`audio ${res.status}`)
    const url = URL.createObjectURL(await res.blob())
    await playUrl(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 30_000))
    return true
  }
  return false
}

function pickMime(): string | undefined {
  // iOS Safari records AAC in MP4; Chrome/Firefox record Opus in WebM.
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(
    (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  )
}

export interface Recorder { stop: () => Promise<Blob>; cancel: () => void }

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  const mimeType = pickMime()
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.start()
  const release = () => stream.getTracks().forEach((t) => t.stop())
  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' }))
        }
        rec.stop()
      }),
    cancel: () => {
      rec.onstop = release
      rec.stop()
    },
  }
}
