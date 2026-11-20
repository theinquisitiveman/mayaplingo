import { useEffect } from 'react'
import { PhraseText, SpeakerButton } from '../components/Phrase'
import { playItem } from '../lib/audio'
import type { Exercise } from '../lib/exercises'
import { useApp } from '../state'
import type { ExerciseProps } from './types'

export function Choice({ ex, value, setValue, locked, onFix }: ExerciseProps<Extract<Exercise, { kind: 'choice' }>>) {
  const { item } = useApp()
  const target = item(ex.itemId)

  useEffect(() => {
    if (ex.mode === 'listen') playItem(target).catch(() => {})
  }, [ex, target])

  const title =
    ex.mode === 'listen' ? 'What did you hear?' : ex.mode === 'meaning' ? 'What does this mean?' : `How do you say “${target.en}”?`

  return (
    <div className="flex flex-1 flex-col">
      {ex.isNew && <div className="mb-1 text-sm font-black uppercase text-beetle">New phrase</div>}
      <h1 className="mb-6 text-2xl font-black">{title}</h1>
      {ex.mode !== 'target' && (
        <div className="mb-8 flex items-center gap-4">
          <SpeakerButton item={target} big={ex.mode === 'listen'} onMissing={() => onFix(target.id)} />
          {ex.mode === 'meaning' && (
            <div className="rounded-2xl border-2 border-swan px-4 py-3 text-2xl font-extrabold">
              <PhraseText item={target} />
            </div>
          )}
        </div>
      )}
      <div className="grid gap-3">
        {ex.options.map((id) => {
          const opt = item(id)
          const selected = value === id
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setValue(id)}
              className={`tile text-lg ${selected ? 'tile-selected' : ''}`}
            >
              {ex.mode === 'target' ? <PhraseText item={opt} /> : opt.en}
            </button>
          )
        })}
      </div>
    </div>
  )
}
