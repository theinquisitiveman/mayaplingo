import { useState } from 'react'
import { CorrectionSheet } from '../components/CorrectionSheet'
import { Mascot } from '../components/Mascot'
import { PhraseText } from '../components/Phrase'
import { Choice } from '../exercises/Choice'
import { Match } from '../exercises/Match'
import { Speak } from '../exercises/Speak'
import { WordBank } from '../exercises/WordBank'
import { buildLesson, exerciseItemIds, isAcceptedSentence, type Exercise } from '../lib/exercises'
import { completeLesson, heartsNow, loseHeart, recordAnswer } from '../lib/progress'
import type { LiveItem } from '../lib/types'
import { useApp } from '../state'

interface Props { items: LiveItem[]; pool: LiveItem[]; lessonId: string | null; practice?: boolean; onExit: () => void }

type Status = 'idle' | 'correct' | 'wrong'

export function Lesson({ items, pool, lessonId, practice = false, onExit }: Props) {
  const { item, progress, setProgress, canListen, acceptAnswer } = useApp()
  const [queue, setQueue] = useState<Exercise[]>(() =>
    buildLesson(items, pool, { canListen, introduce: !practice && !progress.completed[lessonId ?? ''] }),
  )
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [mistakes, setMistakes] = useState(0)
  const [fixing, setFixing] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [finished, setFinished] = useState<{ xp: number } | null>(null)

  const hearts = heartsNow(progress, Date.now()).count
  const ex = queue[index]

  if (!practice && hearts === 0 && !finished) {
    return (
      <Screen>
        <Mascot mood="sad" size={110} />
        <h1 className="mt-6 text-2xl font-black">You're out of hearts</h1>
        <p className="mt-2 text-wolf">Hearts refill over time — one every 30 minutes. Practice doesn't cost hearts.</p>
        <button type="button" className="btn btn-green mt-8" onClick={onExit}>Back</button>
      </Screen>
    )
  }

  if (finished) {
    return (
      <Screen>
        <Mascot mood="cheer" size={120} />
        <h1 className="mt-6 text-3xl font-black text-bee-dark">{practice ? 'Practice complete!' : 'Lesson complete!'}</h1>
        <div className="mt-6 flex gap-3">
          <Stat label="XP" value={`+${finished.xp}`} color="text-bee-dark" />
          <Stat label="Mistakes" value={String(mistakes)} color="text-sky" />
        </div>
        <p className="mt-6 font-bold text-wolf">Mayap! — well done!</p>
        <button type="button" className="btn btn-green mt-8" onClick={onExit}>Continue</button>
      </Screen>
    )
  }

  function check() {
    let ok = true
    if (ex.kind === 'choice') ok = value === ex.itemId
    if (ex.kind === 'wordbank') ok = isAcceptedSentence(value, item(ex.itemId))
    setStatus(ok ? 'correct' : 'wrong')
  }

  function next() {
    const now = Date.now()
    const ok = status === 'correct' || accepted
    setProgress((p) => {
      let n = exerciseItemIds(ex).reduce((acc, id) => recordAnswer(acc, id, ok, now), p)
      if (!ok && !practice) n = loseHeart(n, now)
      return n
    })
    let q = queue
    if (!ok) {
      setMistakes((m) => m + 1)
      q = [...queue, ex] // Duolingo-style: missed exercises come back at the end
      setQueue(q)
    }
    if (index + 1 >= q.length) {
      const xp = (practice ? 5 : 10) + (mistakes === 0 && ok ? 5 : 0)
      setProgress((p) => completeLesson(p, lessonId, xp, Date.now()))
      setFinished({ xp })
      return
    }
    setIndex(index + 1)
    setValue('')
    setStatus('idle')
    setAccepted(false)
  }

  const props = { value, setValue, locked: status !== 'idle' }
  const answerItem = ex.kind === 'match' ? null : item(ex.itemId)
  const showCorrect = status === 'correct' || accepted

  return (
    <div className="safe-top flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pb-4">
        <button type="button" aria-label="Quit lesson" className="text-3xl text-hare" onClick={() => confirm('Quit this lesson? Progress in it will be lost.') && onExit()}>✕</button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-swan" role="progressbar" aria-valuenow={index} aria-valuemax={queue.length}>
          <div className="h-full rounded-full bg-feather transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
        {!practice && <span className="font-extrabold text-cardinal">❤️ {hearts}</span>}
      </header>

      <main key={index} className="anim-pop flex flex-1 flex-col overflow-y-auto px-4">
        {ex.kind === 'choice' && <Choice ex={ex} {...props} />}
        {ex.kind === 'wordbank' && <WordBank ex={ex} {...props} />}
        {ex.kind === 'match' && <Match ex={ex} {...props} />}
        {ex.kind === 'speak' && <Speak ex={ex} {...props} />}
      </main>

      <footer className={`safe-bottom border-t-2 px-4 pt-4 ${status === 'idle' ? 'border-swan' : showCorrect ? 'anim-up border-transparent bg-feather-light' : 'anim-up border-transparent bg-cardinal-light'}`}>
        {status !== 'idle' && (
          <div className="mb-4" role="status">
            <div className={`text-2xl font-black ${showCorrect ? 'text-feather-dark' : 'text-cardinal-dark'}`}>
              {accepted ? 'Thanks — accepted from now on!' : showCorrect ? 'Mayap!' : 'Sayang!'}
            </div>
            {status === 'wrong' && !accepted && answerItem && <div className="text-sm font-black uppercase text-cardinal-dark">Correct answer:</div>}
            {answerItem && (
              <div className={`mt-1 text-lg font-bold ${showCorrect ? 'text-feather-dark' : 'text-cardinal-dark'}`}>
                <PhraseText item={answerItem} /> <span className="font-semibold">— {answerItem.en}</span>
                {answerItem.notes && <div className="text-sm font-semibold opacity-80">{answerItem.notes}</div>}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-extrabold uppercase">
              {exerciseItemIds(ex).length === 1 && (
                <button type="button" className="chip px-3 py-1.5 text-xs uppercase text-sky-dark" onClick={() => setFixing(exerciseItemIds(ex)[0])}>✏️ Fix or record this phrase</button>
              )}
              {status === 'wrong' && ex.kind === 'wordbank' && value && !accepted && (
                <button type="button" className="text-wolf" onClick={() => { acceptAnswer(ex.itemId, value); setAccepted(true) }}>
                  ✓ My answer is also correct
                </button>
              )}
            </div>
          </div>
        )}
        {status === 'idle' ? (
          <button type="button" className="btn btn-green" disabled={!value} onClick={check}>Check</button>
        ) : (
          <button type="button" className={`btn ${showCorrect ? 'btn-green' : 'btn-red'}`} onClick={next}>Continue</button>
        )}
      </footer>

      {fixing && <CorrectionSheet itemId={fixing} onClose={() => setFixing(null)} />}
    </div>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return <div className="safe-top safe-bottom flex h-full flex-col items-center justify-center px-6 text-center">{children}</div>
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="w-28 rounded-2xl border-2 border-swan p-3">
      <div className="text-xs font-black uppercase text-hare">{label}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  )
}
