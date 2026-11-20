import { useState } from 'react'
import { CorrectionSheet } from '../components/CorrectionSheet'
import { SpeakerButton } from '../components/Phrase'
import { normalizeRoman } from '../lib/normalize'
import { useApp } from '../state'

/** Every phrase in the course — the native speaker's review workspace. */
export function Phrasebook() {
  const { course, corrections, recordings } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'todo' | 'mine'>('all')
  const [fixing, setFixing] = useState<string | null>(null)
  const nq = normalizeRoman(q)

  return (
    <div className="px-4 pb-8 pt-2">
      <h1 className="text-2xl font-black">Phrasebook</h1>
      <p className="mb-3 text-sm text-wolf">Tap ✎ to fix a phrase or record how it's really said in Pampanga.</p>
      <input className="field mb-2" placeholder="Search Kapampangan or English" value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="off" />
      <div className="mb-4 flex gap-2 text-sm">
        {(['all', 'todo', 'mine'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`chip py-1 ${filter === f ? 'tile-selected' : ''}`}>
            {f === 'all' ? 'All' : f === 'todo' ? 'Needs review' : 'My fixes'}
          </button>
        ))}
      </div>
      {course.units.map((u) => {
        const items = u.lessons.flatMap((l) => l.items).filter((i) => {
          if (filter === 'todo' && (i.status === 'reviewed' || i.corrected)) return false
          if (filter === 'mine' && !corrections[i.id]) return false
          if (!nq) return true
          return [i.roman, i.en, ...(i.alts ?? [])].some((s) => normalizeRoman(s).includes(nq))
        })
        if (!items.length) return null
        return (
          <section key={u.id} className="mb-5">
            <h2 className="mb-2 text-sm font-black uppercase text-hare">{u.title}</h2>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 rounded-2xl border-2 border-swan p-3">
                  <SpeakerButton item={i} onMissing={() => setFixing(i.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-extrabold">{i.roman}</span>
                    </div>
                    <div className="text-sm text-wolf">{i.en}</div>
                    {i.notes && <div className="text-xs text-hare">{i.notes}</div>}
                    {i.audioSource === 'native' && i.audioCredit && !recordings.has(i.id) && <div className="text-[10px] text-hare">🎙 {i.audioCredit}</div>}
                    <div className="mt-1 flex gap-1 text-[10px] font-black uppercase">
                      {corrections[i.id] ? (
                        <span className="rounded bg-fox/15 px-1.5 py-0.5 text-fox">Your fix</span>
                      ) : i.status === 'reviewed' ? (
                        <span className="rounded bg-feather/15 px-1.5 py-0.5 text-feather-dark">Reviewed</span>
                      ) : (
                        <span className="rounded bg-swan px-1.5 py-0.5 text-wolf">Draft</span>
                      )}
                      {recordings.has(i.id) ? (
                        <span className="rounded bg-sky/15 px-1.5 py-0.5 text-sky-dark">Your recording</span>
                      ) : i.audioSource === 'native' ? (
                        <span className="rounded bg-sky/15 px-1.5 py-0.5 text-sky-dark">Native audio</span>
                      ) : i.audioSource === 'generated' ? (
                        <span className="rounded bg-beetle/15 px-1.5 py-0.5 text-[#a568cc]">Computer voice</span>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" aria-label={`Fix ${i.roman}`} className="chip px-3 text-sky" onClick={() => setFixing(i.id)}>✎</button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {fixing && <CorrectionSheet itemId={fixing} onClose={() => setFixing(null)} />}
    </div>
  )
}
