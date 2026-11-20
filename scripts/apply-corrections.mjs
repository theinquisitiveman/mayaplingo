// Merge corrections exported from the app ("Share my fixes") into the course for everyone.
//   npm run apply-corrections -- path/to/mayaplingo-corrections-2026-11-20.json [more files...]
// Updates content/course.json, writes recordings to public/audio/, marks items reviewed.
import { readFileSync } from 'node:fs'
import { parseCorrectionsFile } from '../src/lib/corrections.ts'
import { applyToCourse } from './lib/course-edit.mjs'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: npm run apply-corrections -- <corrections.json> [...]')
  process.exit(1)
}

const corrections = files
  .flatMap((f) => parseCorrectionsFile(readFileSync(f, 'utf8')).corrections)
  .filter((c) => !c.deleted)
  .map(({ audioDataUrl, ...c }) => {
    if (!audioDataUrl) return c
    const [, mime, b64] = audioDataUrl.match(/^data:(audio\/[\w.+-]+)[^,]*;base64,(.*)$/s)
    return { ...c, audio: { mime, bytes: Buffer.from(b64, 'base64') } }
  })
const { applied } = applyToCourse(corrections)
console.log(`Applied ${applied} correction(s). Run npm run check-content, then commit content/ and public/audio/.`)
