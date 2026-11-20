import { Mascot } from '../components/Mascot'
import { allItems } from '../lib/content'
import { reviewQueue } from '../lib/progress'
import type { LiveItem } from '../lib/types'
import { useApp } from '../state'

export function Practice({ onStart }: { onStart: (items: LiveItem[]) => void }) {
  const { course, progress, item } = useApp()
  const ids = allItems(course).map((i) => i.id)
  const queue = reviewQueue(progress, ids, Date.now())
  const due = ids.filter((id) => progress.srs[id] && progress.srs[id].due <= Date.now()).length

  return (
    <div className="flex flex-col items-center px-6 pt-8 text-center">
      <Mascot size={100} mood={queue.length ? 'happy' : 'sad'} />
      <h1 className="mt-4 text-2xl font-black">Practice</h1>
      {queue.length >= 4 ? (
        <>
          <p className="mt-2 text-wolf">
            {due ? `${due} phrase${due === 1 ? '' : 's'} ready for review.` : 'Keep your phrases fresh.'} Practice never costs hearts.
          </p>
          <ul className="my-6 w-full space-y-2 text-left">
            {queue.map((id) => (
              <li key={id} className="flex justify-between rounded-xl border-2 border-swan px-3 py-2">
                <span className="font-extrabold">{item(id).roman}</span>
                <span className="text-wolf">{item(id).en}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-sky" onClick={() => onStart(queue.map(item))}>Start practice</button>
        </>
      ) : (
        <p className="mt-2 text-wolf">Finish a lesson or two first — phrases you've learned show up here for review.</p>
      )}
    </div>
  )
}
