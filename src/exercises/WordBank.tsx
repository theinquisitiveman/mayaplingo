import { useState } from 'react'
import type { Exercise } from '../lib/exercises'
import { useApp } from '../state'
import type { ExerciseProps } from './types'

export function WordBank({ ex, setValue, locked }: ExerciseProps<Extract<Exercise, { kind: 'wordbank' }>>) {
  const { item } = useApp()
  const target = item(ex.itemId)
  const [picked, setPicked] = useState<number[]>([])

  const update = (next: number[]) => {
    setPicked(next)
    setValue(next.map((i) => ex.tiles[i]).join(' '))
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-2 text-2xl font-black">Say this in Kapampangan</h1>
      <p className="mb-6 text-xl font-bold text-wolf">“{target.en}”</p>
      <div className="mb-8 flex min-h-28 flex-wrap content-start gap-2 border-y-2 border-swan py-3" aria-label="Your answer">
        {picked.map((i) => (
          <button key={i} type="button" disabled={locked} className="chip anim-pop" onClick={() => update(picked.filter((x) => x !== i))}>
            {ex.tiles[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Word bank">
        {ex.tiles.map((t, i) => {
          const used = picked.includes(i)
          return (
            <button
              key={i}
              type="button"
              disabled={locked || used}
              className={`chip ${used ? 'border-swan bg-swan text-transparent' : ''}`}
              onClick={() => update([...picked, i])}
            >
              {t}
            </button>
          )
        })}
      </div>
    </div>
  )
}
