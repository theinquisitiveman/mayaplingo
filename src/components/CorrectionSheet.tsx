import { useEffect, useRef, useState } from 'react'
import { playUrl, startRecording, type Recorder } from '../lib/audio'
import { getRecording } from '../lib/db'
import { useApp } from '../state'

/**
 * "Fix this phrase": lets a native speaker correct the romanization, script, meaning or notes,
 * add accepted alternatives, and record the real Kapampangan pronunciation. Saved corrections apply
 * immediately everywhere in the app and can be exported to merge into the course for everyone.
 */
export function CorrectionSheet({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const { item, original, corrections, recordings, saveCorrection, resetCorrection, settings, updateSettings } = useApp()
  const live = item(itemId)
  const orig = original(itemId)!
  const [roman, setRoman] = useState(live.roman)
  const [en, setEn] = useState(live.en)
  const [notes, setNotes] = useState(live.notes ?? '')
  const [alts, setAlts] = useState((corrections[itemId]?.alts ?? []).join('\n'))
  const [audio, setAudio] = useState<Blob | null | undefined>(undefined) // undefined = unchanged
  const [recorder, setRecorder] = useState<Recorder | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const recorderRef = useRef<Recorder | null>(null)
  recorderRef.current = recorder

  useEffect(() => () => recorderRef.current?.cancel(), [])
  const sheetRef = useSwipeDown(onClose)

  const hasRecording = audio === undefined ? recordings.has(itemId) : !!audio

  async function toggleRecord() {
    setError('')
    if (recorder) {
      setAudio(await recorder.stop())
      setRecorder(null)
      return
    }
    try {
      setRecorder(await startRecording())
    } catch {
      setError('Microphone unavailable. Allow microphone access for this site in Settings › Safari.')
    }
  }

  async function playRecording() {
    const blob = audio ?? (await getRecording(itemId))
    if (!blob) return
    const url = URL.createObjectURL(blob)
    playUrl(url).catch(console.error).finally(() => setTimeout(() => URL.revokeObjectURL(url), 30_000))
  }

  async function save() {
    setSaving(true)
    try {
      await saveCorrection(itemId, { roman, en, notes }, alts.split('\n'), audio)
      onClose()
    } catch (e) {
      setError(`Couldn't save: ${(e as Error).message}`)
      setSaving(false)
    }
  }

  const changedHint = (now: string, was: string | undefined) =>
    now.trim() !== (was ?? '') ? <span className="text-xs font-semibold text-fox">was: {was || '—'}</span> : null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fix-title"
        className="anim-up safe-bottom max-h-[92%] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="-mx-4 -mt-4 mb-1 flex justify-center py-3" aria-hidden>
          <div className="h-1.5 w-12 rounded-full bg-swan" />
        </div>
        <h2 id="fix-title" className="text-xl font-black">Fix this phrase</h2>
        <p className="mb-4 text-sm text-wolf">
          Speak Kapampangan? Correct anything that sounds wrong. Your fix is used in every lesson right away.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="flex justify-between text-sm font-bold">Kapampangan {changedHint(roman, orig.roman)}</span>
            <input className="field" value={roman} onChange={(e) => setRoman(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="block">
            <span className="flex justify-between text-sm font-bold">English meaning {changedHint(en, orig.en)}</span>
            <input className="field" value={en} onChange={(e) => setEn(e.target.value)} />
          </label>
          <label className="block">
            <span className="flex justify-between text-sm font-bold">Notes (usage, other spellings) {changedHint(notes, orig.notes)}</span>
            <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-bold">Also accept (one per line)</span>
            <textarea className="field" rows={2} placeholder="e.g. komusta ka?" value={alts} onChange={(e) => setAlts(e.target.value)} autoCapitalize="off" spellCheck={false} />
          </label>

          <div className="rounded-2xl border-2 border-swan p-3">
            <div className="mb-2 text-sm font-bold">Kapampangan pronunciation</div>
            <div className="flex gap-2">
              <button type="button" onClick={toggleRecord} className={`btn ${recorder ? 'btn-red' : 'btn-sky'} normal-case`}>
                {recorder ? '■ Stop' : hasRecording ? '🎙️ Re-record' : '🎙️ Record'}
              </button>
              {hasRecording && !recorder && (
                <>
                  <button type="button" onClick={playRecording} className="btn btn-ghost w-auto normal-case">▶︎</button>
                  <button type="button" onClick={() => setAudio(null)} className="btn btn-ghost w-auto normal-case text-cardinal" aria-label="Delete recording">✕</button>
                </>
              )}
            </div>
            {recorder && <p className="mt-2 text-sm font-bold text-cardinal">● Recording… say the phrase once, clearly.</p>}
          </div>

          <label className="block">
            <span className="text-sm font-bold">Your name (optional, credited in the course)</span>
            <input className="field" value={settings.reviewerName} onChange={(e) => updateSettings({ reviewerName: e.target.value })} />
          </label>

          {error && <p role="alert" className="text-sm font-bold text-cardinal">{error}</p>}

          <div className="space-y-2 pb-2 pt-1">
            <button type="button" className="btn btn-green" disabled={saving || !!recorder} onClick={save}>Save fix</button>
            {corrections[itemId] && (
              <button type="button" className="btn btn-ghost text-cardinal" onClick={async () => { await resetCorrection(itemId); onClose() }}>
                Reset to original
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Swipe the sheet down to close it, like native iOS sheets. Works from anywhere on the sheet while it's
 * scrolled to the top; otherwise the gesture scrolls the content as usual.
 */
function useSwipeDown(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startY = 0, startT = 0, dy = 0, fromTop = false, dragging = false
    const reset = (animate: boolean) => {
      el.style.transition = animate ? 'transform .2s ease-out' : ''
      el.style.transform = ''
    }
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      startT = e.timeStamp
      dy = 0
      fromTop = el.scrollTop <= 0
      dragging = false
    }
    const onMove = (e: TouchEvent) => {
      dy = e.touches[0].clientY - startY
      if (!fromTop || (dy <= 0 && !dragging)) return
      dragging = true
      e.preventDefault() // stop the page from scrolling/bouncing while the sheet follows the finger
      el.style.transition = 'none'
      el.style.transform = `translateY(${Math.max(0, dy)}px)`
    }
    const onEnd = (e: TouchEvent) => {
      if (!dragging) return
      dragging = false
      const fast = dy / Math.max(1, e.timeStamp - startT) > 0.5
      if (dy > 120 || (fast && dy > 40)) {
        el.style.transition = 'transform .2s ease-in'
        el.style.transform = 'translateY(100%)'
        setTimeout(() => close.current(), 180)
      } else reset(true)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    const onCancel = () => { dragging = false; reset(true) }
    el.addEventListener('touchcancel', onCancel)
    return () => {
      el.removeEventListener('touchcancel', onCancel)
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])
  return ref
}
