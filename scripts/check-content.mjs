// Validates content/course.json and that every referenced audio file exists.
import { existsSync, readFileSync } from 'node:fs'
import { validateCourse } from '../src/lib/content.ts'

const course = JSON.parse(readFileSync(new URL('../content/course.json', import.meta.url)))
const problems = validateCourse(course)
for (const u of course.units)
  for (const l of u.lessons)
    for (const i of l.items)
      if (i.audio && !existsSync(new URL(`../public/${i.audio}`, import.meta.url))) problems.push(`item ${i.id}: missing audio ${i.audio}`)

if (problems.length) {
  console.error(`Content problems:\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
const items = course.units.flatMap((u) => u.lessons.flatMap((l) => l.items))
console.log(`Content OK: ${course.units.length} units, ${items.length} phrases, ${items.filter((i) => i.status === 'reviewed').length} reviewed, ${items.filter((i) => i.audio).length} with audio.`)
