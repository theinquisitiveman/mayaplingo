import { useEffect, useRef, useState } from 'react'
import { PhraseText, SpeakerButton } from '../components/Phrase'
import { playUrl, startRecording, type Recorder } from '../lib/audio'
import type { Exercise } from '../lib/exercises'
import { useApp } from '../state'
import type { ExerciseProps } from './types'

/** Record yourself and compare with the native recording. No automatic scoring: no Kapampangan speech recognition on iOS. */
export function Speak({ ex, setValue, locked }: ExerciseProps<Extract<Exercise, { kind: 'speak' }>>) {
  const { item } = useApp()
  const target = item(ex.itemId)
  const [rec, setRec] = useState<Recorder | null>(null)
  const [mine, setMine] = useState<string | null>(null)
  const [error, setError] = useState('')
  const recRef = useRef<Recorder | null>(null)
  recRef.current = rec

  useEffect(() => () => { recRef.current?.cancel() }, [])
  useEffect(() => () => { if (mine) URL.revokeObjectURL(mine) }, [mine])

  async function toggle() {
    setError('')
    if (rec) {
      const blob = await rec.stop()
      setRec(null)
      setMine(URL.createObjectURL(blob))
      setValue('done')
      return
    }
    try { setRec(await startRecording()) } catch { setError('Microphone unavailable — you can skip this one.') }
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-2xl font-black">Say it out loud</h1>
      <div className="mb-8 flex items-center gap-4">
        <SpeakerButton item={target} />
        <div className="rounded-2xl border-2 border-swan px-4 py-3 text-2xl font-extrabold">
          <PhraseText item={target} />
          <div className="text-base font-bold text-wolf">{target.en}</div>
        </div>
      </div>
      <button type="button" disabled={locked} onClick={toggle} className={`btn ${rec ? 'btn-red' : 'btn-sky'} py-6 text-lg`}>
        {rec ? '■ Tap to stop' : mine ? '🎙️ Try again' : '🎙️ Tap to speak'}
      </button>
      {mine && (
        <button type="button" onClick={() => playUrl(mine)} className="btn btn-ghost mt-3 normal-case">▶︎ Hear yourself</button>
      )}
      {error && <p role="alert" className="mt-3 font-bold text-cardinal">{error}</p>}
      {!locked && !mine && (
        <button type="button" className="mt-auto pt-6 font-extrabold uppercase text-hare" onClick={() => setValue('skip')}>
          Can't speak now
        </button>
      )}
    </div>
  )
}
