import { useRef, useState } from 'react'
import { Account } from '../components/Account'
import { allItems } from '../lib/content'
import { currentStreak } from '../lib/progress'
import { useApp } from '../state'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export function Profile() {
  const { course, progress, corrections, exportCorrections, importCorrections } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const items = allItems(course)
  const reviewed = items.filter((i) => i.status === 'reviewed').length
  const fixCount = Object.keys(corrections).length

  async function share() {
    setMsg('')
    try {
      const file = await exportCorrections()
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'MayapLingo corrections' })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(file)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(`Export failed: ${(e as Error).message}`)
    }
  }

  async function onImport(f: File | undefined) {
    if (!f) return
    try {
      const n = await importCorrections(await f.text())
      setMsg(`Imported ${n} correction${n === 1 ? '' : 's'}.`)
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6 px-4 pb-10 pt-2">
      <h1 className="text-2xl font-black">Profile</h1>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat icon="🔥" value={currentStreak(progress, Date.now())} label="day streak" />
        <Stat icon="⚡" value={progress.xp} label="total XP" />
        <Stat icon="📗" value={Object.keys(progress.completed).length} label="lessons" />
      </div>

      <Account />

      {!isStandalone() && (
        <Card title="Install on your iPhone">
          In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. MayapLingo then opens full-screen and works offline.
        </Card>
      )}

      <Card title="Help teach real Kapampangan">
        <p className="mb-3">
          {reviewed} of {items.length} phrases are reviewed by native speakers. You've fixed <b>{fixCount}</b>. Your fixes are used in your lessons immediately;
          share them with the course maintainer so every learner gets them.
        </p>
        <div className="space-y-2">
          <button type="button" className="btn btn-sky" disabled={!fixCount} onClick={share}>Share my fixes</button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Import fixes file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        {msg && <p role="status" className="mt-2 font-bold text-sky-dark">{msg}</p>}
      </Card>

      <Card title="About this course">
        <p className="mb-2">{course.about}</p>
        <ul className="list-disc space-y-1 pl-5 text-xs">
          {course.sources.map((s) => <li key={s} className="break-words">{s}</li>)}
        </ul>
      </Card>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="rounded-2xl border-2 border-swan p-3">
      <div className="text-xl font-black">{icon} {value}</div>
      <div className="text-xs font-bold text-hare">{label}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-swan p-4 text-sm text-wolf">
      <h2 className="mb-2 text-base font-black text-eel">{title}</h2>
      {children}
    </section>
  )
}
