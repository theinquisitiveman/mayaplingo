import { normalizeRoman, tokenize } from './normalize'
import type { LiveItem } from './types'

export type Exercise =
  | { kind: 'choice'; mode: 'meaning' | 'listen' | 'target'; itemId: string; options: string[]; isNew?: boolean }
  | { kind: 'wordbank'; itemId: string; tiles: string[] }
  | { kind: 'match'; itemIds: string[] }
  | { kind: 'speak'; itemId: string }

type Rng = () => number

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Pick distractors that can't be confused with the answer (e.g. two items both meaning "thank you"). */
export function pickOptions(target: LiveItem, pool: LiveItem[], n: number, rng: Rng = Math.random): string[] {
  const seenEn = new Set([normalizeRoman(target.en)])
  const seenRoman = new Set([normalizeRoman(target.roman)])
  const distractors: string[] = []
  for (const it of shuffle(pool, rng)) {
    if (distractors.length >= n - 1) break
    const en = normalizeRoman(it.en)
    const ro = normalizeRoman(it.roman)
    if (it.id === target.id || seenEn.has(en) || seenRoman.has(ro)) continue
    seenEn.add(en)
    seenRoman.add(ro)
    distractors.push(it.id)
  }
  return shuffle([target.id, ...distractors], rng)
}

/**
 * Build a Duolingo-style lesson from a list of items. Exercises are generated rather than
 * hand-authored so that a correction to an item flows into every exercise that uses it.
 */
export function buildLesson(
  items: LiveItem[],
  pool: LiveItem[],
  opts: { canListen: (item: LiveItem) => boolean; introduce?: boolean; rng?: Rng },
): Exercise[] {
  const rng = opts.rng ?? Math.random
  const choicePool = pool.length >= 4 ? pool : items
  const first: Exercise[] = items.map((it) => ({
    kind: 'choice',
    mode: opts.canListen(it) && rng() < 0.5 ? 'listen' : 'meaning',
    itemId: it.id,
    options: pickOptions(it, choicePool, 4, rng),
    isNew: opts.introduce,
  }))

  const second: Exercise[] = items.map((it) => {
    const words = tokenize(it.roman)
    if (words.length >= 2) {
      const extra = shuffle(
        pool.flatMap((p) => tokenize(p.roman)).filter((w) => !words.some((x) => normalizeRoman(x) === normalizeRoman(w))),
        rng,
      )
      return { kind: 'wordbank', itemId: it.id, tiles: shuffle([...words, ...new Set(extra)].slice(0, words.length + 2), rng) }
    }
    return { kind: 'choice', mode: 'target', itemId: it.id, options: pickOptions(it, choicePool, 4, rng) }
  })

  const out: Exercise[] = [...first, ...shuffle(second, rng)]
  if (items.length >= 3) {
    out.splice(items.length, 0, { kind: 'match', itemIds: shuffle(items, rng).slice(0, 5).map((i) => i.id) })
  }
  out.push({ kind: 'speak', itemId: items[Math.floor(rng() * items.length)].id })
  return out
}

export function exerciseItemIds(ex: Exercise): string[] {
  return ex.kind === 'match' ? ex.itemIds : [ex.itemId]
}

/** Is a word-bank answer acceptable? Matches the item's romanization or any accepted alternative. */
export function isAcceptedSentence(answer: string, item: LiveItem): boolean {
  const a = normalizeRoman(answer)
  return [item.roman, ...(item.alts ?? [])].some((s) => normalizeRoman(s) === a)
}
