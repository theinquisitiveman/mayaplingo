import type { Correction, Corrections } from './types'

/** File format shared between the app (export/import) and scripts/apply-corrections.mjs. */
export interface CorrectionsFile {
  format: 'mayaplingo-corrections'
  version: 1
  exportedAt: string
  by?: string
  corrections: (Correction & { audioDataUrl?: string })[]
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

export function parseCorrectionsFile(text: string): CorrectionsFile {
  const data = JSON.parse(text)
  if (data?.format !== 'mayaplingo-corrections' || !Array.isArray(data.corrections)) {
    throw new Error('Not a MayapLingo corrections file')
  }
  for (const c of data.corrections) {
    if (typeof c?.itemId !== 'string' || typeof c.updatedAt !== 'number' || typeof c.fields !== 'object') {
      throw new Error('Corrections file is malformed')
    }
    for (const [k, v] of Object.entries(c.fields)) {
      if (!['roman', 'en', 'notes'].includes(k) || typeof v !== 'string') throw new Error(`Bad field ${k}`)
    }
    if (c.audioDataUrl !== undefined && !/^data:audio\/[\w.+-]+(;[\w=.+-]+)*;base64,/.test(c.audioDataUrl)) {
      throw new Error('Bad audio in corrections file')
    }
  }
  return data
}

/** Merge imported corrections into local ones; the newer edit of an item wins. Unknown items are dropped. */
export function mergeCorrections(local: Corrections, incoming: Correction[], knownIds: Set<string>): Corrections {
  const out = { ...local }
  for (const c of incoming) {
    if (!knownIds.has(c.itemId)) continue
    if (!out[c.itemId] || out[c.itemId].updatedAt < c.updatedAt) {
      const { itemId, fields, alts, hasAudio, by, updatedAt, deleted } = c
      out[c.itemId] = { itemId, fields, alts, hasAudio, by, updatedAt, ...(deleted ? { deleted } : {}) }
    }
  }
  return out
}
