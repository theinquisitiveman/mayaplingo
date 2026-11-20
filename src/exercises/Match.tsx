import { useMemo, useState } from 'react'
import { shuffle, type Exercise } from '../lib/exercises'
import { useApp } from '../state'
import type { ExerciseProps } from './types'

export function Match({ ex, setValue }: ExerciseProps<Extract<Exercise, { kind: 'match' }>>) {
  const { item } = useApp()
  const left = useMemo(() => shuffle(ex.itemIds), [ex])
  const right = useMemo(() => shuffle(ex.itemIds), [ex])
  const [sel, setSel] = useState<{ l?: string; r?: string }>({})
  const [done, setDone] = useState<Set<string>>(new Set())
  const [miss, setMiss] = useState(0)

  function pick(side: 'l' | 'r', id: string) {
    const next = { ...sel, [side]: id }
    if (next.l && next.r) {
      if (next.l === next.r) {
        const d = new Set(done).add(id)
        setDone(d)
        if (d.size === ex.itemIds.length) setValue('done')
      } else {
        setMiss((m) => m + 1)
      }
      setSel({})
    } else setSel(next)
  }

  const cls = (side: 'l' | 'r', id: string) =>
    `tile text-center ${done.has(id) ? 'border-swan text-swan' : sel[side] === id ? 'tile-selected' : ''}`

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="mb-6 text-2xl font-black">Tap the matching pairs</h1>
      <div key={miss} className={`grid grid-cols-2 gap-3 ${miss ? 'anim-shake' : ''}`}>
        <div className="grid gap-3">
          {left.map((id) => (
            <button key={id} type="button" disabled={done.has(id)} className={cls('l', id)} onClick={() => pick('l', id)}>
              {item(id).roman}
            </button>
          ))}
        </div>
        <div className="grid gap-3">
          {right.map((id) => (
            <button key={id} type="button" disabled={done.has(id)} className={cls('r', id)} onClick={() => pick('r', id)}>
              {item(id).en}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
