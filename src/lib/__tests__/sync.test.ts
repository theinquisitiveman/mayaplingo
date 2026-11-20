import { describe, expect, it } from 'vitest'
import { applyCorrections, allItems } from '../content'
import { defaultSettings } from '../db'
import { emptyProgress, recordAnswer, completeLesson } from '../progress'
import { stableJson } from '../stableJson'
import { mergeProgress, mergeState } from '../sync'
import course from '../../../content/course.json'
import type { Course } from '../types'

const known = new Set(['ali', 'wa'])

describe('mergeProgress', () => {
  it('keeps the further-along totals and the latest answer per phrase', () => {
    const t = new Date(2026, 10, 10, 12).getTime()
    let a = completeLesson(emptyProgress(t), 'l1', 30, t)
    a = recordAnswer(a, 'x', true, t)
    let b = completeLesson(emptyProgress(t), 'l2', 10, t + 86_400_000)
    b = recordAnswer(b, 'x', false, t + 1000) // answered wrong later on the other device
    const m = mergeProgress(a, b)
    expect(m.xp).toBe(30)
    expect(m.completed).toEqual({ l1: 1, l2: 1 })
    expect(m.srs.x.box).toBe(1)
    expect(m.streak.lastDay).toBe(b.streak.lastDay)
    expect(mergeProgress(b, a)).toEqual(m) // order doesn't matter
  })
})

describe('mergeState', () => {
  const local = { progress: emptyProgress(1), settings: defaultSettings, corrections: {} }

  it('uses local state as-is for a brand-new account', () => {
    expect(mergeState(local, null, known)).toBe(local)
  })

  it('a reset on one device beats an older fix on another (tombstones)', () => {
    const fix = { itemId: 'ali', fields: { roman: 'ale' }, updatedAt: 1 }
    const reset = { itemId: 'ali', fields: {}, deleted: true, updatedAt: 2 }
    const m = mergeState({ ...local, corrections: { ali: fix } }, { corrections: { ali: reset } }, known)
    expect(m.corrections.ali.deleted).toBe(true)
    const it0 = allItems(applyCorrections(course as Course, m.corrections)).find((i) => i.id === 'ali')!
    expect(it0.roman).toBe('ali')
    expect(it0.corrected).toBeUndefined()
  })

  it('account settings override device defaults', () => {
    const m = mergeState(local, { settings: { ...defaultSettings, reviewerName: 'Apung Maria' } }, known)
    expect(m.settings.reviewerName).toBe('Apung Maria')
  })
})

describe('stableJson', () => {
  it('ignores key order', () => expect(stableJson({ a: 1, b: { c: 2, d: 3 } })).toBe(stableJson({ b: { d: 3, c: 2 }, a: 1 })))
})
