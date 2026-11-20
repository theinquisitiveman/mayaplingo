import { useState } from 'react'
import { playItem } from '../lib/audio'
import type { LiveItem } from '../lib/types'
import { useApp } from '../state'

/** Plays the phrase. It never edits: corrections and recordings go through the Fix/Record button. */
export function SpeakerButton({ item, big }: { item: LiveItem; big?: boolean }) {
  const { canListen } = useApp()
  const [busy, setBusy] = useState(false)
  const available = canListen(item)
  return (
    <button
      type="button"
      disabled={!available}
      aria-label={available ? `Play ${item.roman}` : `No audio for ${item.roman} yet`}
      title={available ? 'Listen' : 'No audio yet'}
      onClick={async () => {
        setBusy(true)
        try { await playItem(item) } catch (e) { console.error(e) } finally { setBusy(false) }
      }}
      className={`grid shrink-0 place-items-center rounded-2xl border-2 border-b-4 ${
        available ? 'border-sky-dark bg-sky text-white' : 'border-swan bg-polar text-hare opacity-50'
      } ${big ? 'h-24 w-24 text-4xl' : 'h-11 w-11 text-xl'} ${busy ? 'opacity-70' : ''}`}
    >
      {available ? '🔊' : '🔇'}
    </button>
  )
}

/** A Kapampangan phrase as shown in exercises. */
export function PhraseText({ item, className = '' }: { item: LiveItem; className?: string }) {
  return <span className={className}>{item.roman}</span>
}
