import { useState } from 'react'
import { Mascot } from './components/Mascot'
import { allItems } from './lib/content'
import { currentStreak, heartsNow } from './lib/progress'
import type { LiveItem } from './lib/types'
import { Lesson } from './screens/Lesson'
import { Path } from './screens/Path'
import { Phrasebook } from './screens/Phrasebook'
import { Practice } from './screens/Practice'
import { Profile } from './screens/Profile'
import { useApp } from './state'

type Tab = 'learn' | 'practice' | 'phrases' | 'me'
type Active = { items: LiveItem[]; pool: LiveItem[]; lessonId: string | null; practice: boolean }

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'learn', icon: '🏠', label: 'Learn' },
  { id: 'practice', icon: '🏋️', label: 'Practice' },
  { id: 'phrases', icon: '📖', label: 'Phrases' },
  { id: 'me', icon: '👤', label: 'Me' },
]

export default function App() {
  const { ready, course, progress, accountsEnabled, email } = useApp()
  const [tab, setTab] = useState<Tab>('learn')
  const [active, setActive] = useState<Active | null>(null)

  if (!ready) {
    return <div className="grid h-full place-items-center"><Mascot /></div>
  }

  if (active) return <Lesson key={active.lessonId ?? 'practice'} {...active} onExit={() => setActive(null)} />

  const now = Date.now()
  return (
    <div className="flex h-full flex-col">
      <header className="safe-top flex items-center justify-between border-b-2 border-swan px-4 pb-3 font-black">
        <span className="text-xl text-feather">MayapLingo</span>
        <div className="flex gap-4">
          <span className="text-fox" aria-label="day streak">🔥 {currentStreak(progress, now)}</span>
          <span className="text-bee-dark" aria-label="XP">⚡ {progress.xp}</span>
          <span className="text-cardinal" aria-label="hearts">❤️ {heartsNow(progress, now).count}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pt-4">
        {tab === 'learn' && accountsEnabled && !email && Object.keys(progress.completed).length > 0 && (
          <button type="button" onClick={() => setTab('me')} className="mx-4 mb-6 block w-[calc(100%-2rem)] rounded-2xl border-2 border-sky bg-sky/10 px-4 py-3 text-left text-sm font-bold text-sky-dark">
            💾 Create a free account to save your progress →
          </button>
        )}
        {tab === 'learn' && (
          <Path
            onStart={(unit, lesson) =>
              setActive({ items: lesson.items, pool: unit.lessons.flatMap((l) => l.items), lessonId: lesson.id, practice: false })
            }
          />
        )}
        {tab === 'practice' && <Practice onStart={(items) => setActive({ items, pool: allItems(course), lessonId: null, practice: true })} />}
        {tab === 'phrases' && <Phrasebook />}
        {tab === 'me' && <Profile />}
      </main>

      <nav className="safe-bottom grid grid-cols-4 border-t-2 border-swan pt-2" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`mx-2 flex flex-col items-center rounded-xl border-2 py-1 text-xs font-extrabold uppercase ${
              tab === t.id ? 'border-sky bg-sky/10 text-sky' : 'border-transparent text-hare'
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
