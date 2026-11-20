import { useState } from 'react'
import { playItem } from '../lib/audio'
import type { LiveItem } from '../lib/types'
import { useApp } from '../state'

export function SpeakerButton({ item, big, onMissing }: { item: LiveItem; big?: boolean; onMissing?: () => void }) {
  const { canListen } = useApp()
  const [busy, setBusy] = useState(false)
  const available = canListen(item)
  return (
    <button
      type="button"
      aria-label={available ? `Play ${item.roman}` : `No recording for ${item.roman} yet — record one`}
      onClick={async () => {
        if (!available) return onMissing?.()
        setBusy(true)
        try { await playItem(item) } catch (e) { console.error(e) } finally { setBusy(false) }
      }}
      className={`grid shrink-0 place-items-center rounded-2xl border-2 border-b-4 ${
        available ? 'border-sky-dark bg-sky text-white' : 'border-swan bg-polar text-hare'
      } ${big ? 'h-24 w-24 text-4xl' : 'h-11 w-11 text-xl'} ${busy ? 'opacity-70' : ''}`}
    >
      {available ? '🔊' : '🎙️'}
    </button>
  )
}

/** A Kapampangan phrase as shown in exercises. */
export function PhraseText({ item, className = '' }: { item: LiveItem; className?: string }) {
  return <span className={className}>{item.roman}</span>
}
