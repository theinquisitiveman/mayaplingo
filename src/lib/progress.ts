export const MAX_HEARTS = 5
export const HEART_REFILL_MS = 30 * 60 * 1000
const SRS_DAYS = [0, 1, 2, 4, 7, 14] // Leitner box -> days until next review

export interface Progress {
  xp: number
  streak: { count: number; lastDay: string | null }
  daily: { day: string | null; xp: number }
  hearts: { count: number; updatedAt: number }
  completed: Record<string, number> // lessonId -> times completed
  srs: Record<string, { box: number; due: number; at?: number }>
}

export const emptyProgress = (now = Date.now()): Progress => ({
  xp: 0,
  streak: { count: 0, lastDay: null },
  daily: { day: null, xp: 0 },
  hearts: { count: MAX_HEARTS, updatedAt: now },
  completed: {},
  srs: {},
})

/** Local calendar day, so a streak follows the learner's clock rather than UTC. */
export function dayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function previousDay(t: number): string {
  const d = new Date(t)
  d.setDate(d.getDate() - 1)
  return dayKey(d.getTime())
}

/** Streak still counts if you practiced today or yesterday. */
export function currentStreak(p: Progress, now: number): number {
  const { lastDay, count } = p.streak
  return lastDay === dayKey(now) || lastDay === previousDay(now) ? count : 0
}

export function heartsNow(p: Progress, now: number): Progress['hearts'] {
  const { count, updatedAt } = p.hearts
  if (count >= MAX_HEARTS) return { count: MAX_HEARTS, updatedAt: now }
  const gained = Math.floor((now - updatedAt) / HEART_REFILL_MS)
  if (gained <= 0) return p.hearts
  const next = Math.min(MAX_HEARTS, count + gained)
  return { count: next, updatedAt: next >= MAX_HEARTS ? now : updatedAt + gained * HEART_REFILL_MS }
}

export function loseHeart(p: Progress, now: number): Progress {
  const h = heartsNow(p, now)
  return { ...p, hearts: { count: Math.max(0, h.count - 1), updatedAt: h.updatedAt } }
}

export function completeLesson(p: Progress, lessonId: string | null, xpGain: number, now: number): Progress {
  const today = dayKey(now)
  const streakCount =
    p.streak.lastDay === today ? p.streak.count : p.streak.lastDay === previousDay(now) ? p.streak.count + 1 : 1
  return {
    ...p,
    xp: p.xp + xpGain,
    streak: { count: streakCount, lastDay: today },
    daily: { day: today, xp: (p.daily.day === today ? p.daily.xp : 0) + xpGain },
    completed: lessonId ? { ...p.completed, [lessonId]: (p.completed[lessonId] ?? 0) + 1 } : p.completed,
  }
}

export function recordAnswer(p: Progress, itemId: string, correct: boolean, now: number): Progress {
  const prev = p.srs[itemId]?.box ?? 0
  const box = correct ? Math.min(SRS_DAYS.length - 1, prev + 1) : 1
  return { ...p, srs: { ...p.srs, [itemId]: { box, due: now + SRS_DAYS[box] * 86_400_000, at: now } } }
}

/** Items to practice: overdue first, then the weakest. */
export function reviewQueue(p: Progress, itemIds: string[], now: number, n = 6): string[] {
  return itemIds
    .filter((id) => p.srs[id])
    .sort((a, b) => {
      const A = p.srs[a], B = p.srs[b]
      const overdueA = A.due <= now ? 0 : 1, overdueB = B.due <= now ? 0 : 1
      return overdueA - overdueB || A.box - B.box || A.due - B.due
    })
    .slice(0, n)
}
