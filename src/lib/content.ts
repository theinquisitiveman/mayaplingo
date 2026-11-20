import type { Correction, Corrections, Course, Item, LiveItem } from './types'

/** Structural check run at build time (scripts/check-content.mjs) and in tests. Returns problems found. */
export function validateCourse(course: Course): string[] {
  const problems: string[] = []
  const ids = new Set<string>()
  const lessonIds = new Set<string>()
  for (const unit of course.units) {
    if (!unit.lessons.length) problems.push(`unit ${unit.id} has no lessons`)
    for (const lesson of unit.lessons) {
      if (lessonIds.has(lesson.id)) problems.push(`duplicate lesson id ${lesson.id}`)
      lessonIds.add(lesson.id)
      if (lesson.items.length < 4) problems.push(`lesson ${lesson.id} needs at least 4 items for multiple choice`)
      for (const item of lesson.items) {
        if (ids.has(item.id)) problems.push(`duplicate item id ${item.id}`)
        ids.add(item.id)
        for (const f of ['roman', 'en'] as const) {
          if (!item[f]?.trim()) problems.push(`item ${item.id} missing ${f}`)
        }
        if (item.status !== 'draft' && item.status !== 'reviewed') problems.push(`item ${item.id} has bad status`)
        if (item.audio && (!item.audioSource || !item.audioCredit)) problems.push(`item ${item.id} audio needs audioSource and audioCredit`)
      }
    }
  }
  return problems
}

export function mergeItem(item: Item, c: Correction | undefined): LiveItem {
  if (!c || c.deleted) return item
  const alts = [...new Set([...(item.alts ?? []), ...(c.alts ?? [])])]
  return { ...item, ...c.fields, alts, corrected: true }
}

/** The course as this user sees it: their corrections take effect everywhere immediately. */
export function applyCorrections(course: Course, corrections: Corrections): Course {
  return {
    ...course,
    units: course.units.map((u) => ({
      ...u,
      lessons: u.lessons.map((l) => ({ ...l, items: l.items.map((i) => mergeItem(i, corrections[i.id])) })),
    })),
  }
}

export function allItems(course: Course): LiveItem[] {
  return course.units.flatMap((u) => u.lessons.flatMap((l) => l.items))
}
