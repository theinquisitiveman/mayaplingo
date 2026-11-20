import { Mascot } from '../components/Mascot'
import type { Lesson, Unit } from '../lib/types'
import { useApp } from '../state'

const UNIT_COLORS: Record<string, string> = {
  green: 'bg-feather border-feather-dark',
  blue: 'bg-sky border-sky-dark',
  purple: 'bg-beetle border-[#a568cc]',
  orange: 'bg-fox border-[#cc7800]',
  red: 'bg-cardinal border-cardinal-dark',
  gold: 'bg-bee border-bee-dark',
}
const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44] // winding path

export function Path({ onStart }: { onStart: (unit: Unit, lesson: Lesson) => void }) {
  const { course, progress } = useApp()
  const lessons = course.units.flatMap((u) => u.lessons)
  const currentId = lessons.find((l) => !progress.completed[l.id])?.id
  const currentIndex = currentId ? lessons.findIndex((l) => l.id === currentId) : lessons.length
  let n = -1

  return (
    <div className="pb-8">
      {course.units.map((unit) => (
        <section key={unit.id} className="mb-6">
          <div className={`sticky top-0 z-10 mx-4 mb-8 rounded-2xl border-b-4 px-4 py-3 text-white ${UNIT_COLORS[unit.color] ?? UNIT_COLORS.green}`}>
            <div className="text-xs font-black uppercase opacity-80">Unit {unit.id.slice(1)}</div>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-black">{unit.title}</h2>
              <span className="text-base font-bold italic opacity-90">{unit.titleNative}</span>
            </div>
          </div>
          <ol className="flex flex-col items-center gap-10 pt-8">
            {unit.lessons.map((lesson) => {
              n++
              const i = n
              const done = !!progress.completed[lesson.id]
              const current = lesson.id === currentId
              // Duolingo-style: completed lessons and the current one are open; everything after is locked.
              const locked = i > currentIndex
              return (
                <li key={lesson.id} className="relative" style={{ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` }}>
                  {current && (
                    <div className="anim-bob absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl border-2 border-swan bg-white px-3 py-1 text-sm font-black uppercase text-feather">
                      Start
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={locked}
                    aria-label={`${lesson.title}${done ? ', completed' : locked ? ', locked' : ''}`}
                    onClick={() => onStart(unit, lesson)}
                    className={`grid h-18 w-18 place-items-center rounded-full border-b-[6px] text-3xl transition active:translate-y-1 active:border-b-2 ${
                      locked ? "border-[#cecece] bg-swan text-hare" : done ? "border-bee-dark bg-bee text-white" : `${UNIT_COLORS[unit.color]} text-white`
                    } ${current ? 'ring-8 ring-swan' : ''}`}
                  >
                    {locked ? '🔒' : done ? '✓' : '★'}
                  </button>
                  <div className="mt-1 w-24 -translate-x-3 text-center text-xs font-extrabold text-wolf">{lesson.title}</div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      <div className="flex flex-col items-center gap-2 px-6 text-center text-wolf">
        <Mascot size={70} />
        <p className="font-bold">More units coming — help by fixing phrases in the Phrasebook!</p>
      </div>
    </div>
  )
}
