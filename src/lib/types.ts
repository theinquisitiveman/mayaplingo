export type Status = 'draft' | 'reviewed'

export interface Item {
  id: string
  roman: string
  en: string
  notes?: string
  /** Other romanizations/phrasings that count as correct. */
  alts?: string[]
  /** Bundled native recording, relative to the app base (e.g. "audio/salaam.m4a"). */
  audio?: string
  status: Status
}

export interface Lesson { id: string; title: string; items: LiveItem[] }
export interface Unit { id: string; title: string; titleNative: string; color: string; lessons: Lesson[] }
export interface Course { version: number; about: string; sources: string[]; contributors?: string[]; units: Unit[] }

/** A user's fix to one item. Only changed fields are stored; the recording lives separately in IndexedDB. */
export interface Correction {
  itemId: string
  fields: Partial<Pick<Item, 'roman' | 'en' | 'notes'>>
  alts?: string[]
  hasAudio?: boolean
  by?: string
  updatedAt: number
  /** Tombstone: the user reset this item. Kept so the reset syncs to their other devices. */
  deleted?: boolean
}

export type Corrections = Record<string, Correction>

/** An item after the user's correction has been merged in. */
export interface LiveItem extends Item {
  corrected?: boolean
}
