// Publish one account's fixes and recordings to the course for every learner.
//   npm run publish-account -- you@example.com            (hosted project linked in supabase/.temp)
//   npm run publish-account -- you@example.com --dry-run  (show what would change, write nothing)
//   npm run publish-account -- you@example.com --local    (local Supabase from `npx supabase start`)
// Reads that account's data with the project's secret key, which is fetched from the Supabase CLI
// at run time and never written to disk. The account itself is left unchanged.
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { applyToCourse } from './lib/course-edit.mjs'

const args = process.argv.slice(2)
const email = args.find((a) => a.includes('@'))?.toLowerCase()
const dryRun = args.includes('--dry-run'), local = args.includes('--local')
if (!email) {
  console.error('usage: npm run publish-account -- <email> [--dry-run] [--local]')
  process.exit(1)
}

const cli = (cmd) => execSync(`npx supabase ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
let url, secret
if (local) {
  const s = JSON.parse(cli('status -o json').replace(/^[^{]*/, ''))
  url = s.API_URL; secret = s.SECRET_KEY ?? s.SERVICE_ROLE_KEY
} else {
  const ref = readFileSync(new URL('../supabase/.temp/project-ref', import.meta.url), 'utf8').trim()
  const keys = JSON.parse(cli(`projects api-keys --project-ref ${ref} --reveal -o json`).replace(/^[^[]*/, ''))
  url = `https://${ref}.supabase.co`; secret = keys.find((k) => k.type === 'secret')?.api_key
}
if (!secret) throw new Error('could not get the project secret key from the Supabase CLI (are you logged in?)')
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })

let user
for (let page = 1; !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
  if (error) throw error
  user = data.users.find((u) => u.email?.toLowerCase() === email)
  if (data.users.length < 1000) break
}
if (!user) { console.error(`No account with email ${email}`); process.exit(1) }

const { data: row, error } = await admin.from('user_state').select('settings, corrections').eq('user_id', user.id).maybeSingle()
if (error) throw error
const active = Object.values(row?.corrections ?? {}).filter((c) => !c.deleted)
if (!active.length) { console.log(`${email} has no fixes or recordings to publish.`); process.exit(0) }

const by = row.settings?.reviewerName || undefined
const corrections = []
for (const c of active) {
  let audio
  if (c.hasAudio) {
    const { data: blob, error: e } = await admin.storage.from('recordings').download(`${user.id}/${c.itemId}`)
    if (e) console.warn(`! ${c.itemId}: recording missing in storage (${e.message}); publishing text only`)
    else audio = { mime: blob.type || 'audio/mp4', bytes: Buffer.from(await blob.arrayBuffer()) }
  }
  corrections.push({ itemId: c.itemId, fields: c.fields, alts: c.alts, by: c.by ?? by, updatedAt: c.updatedAt, audio })
}

const { applied, withAudio } = applyToCourse(corrections, { dryRun })
console.log(`${dryRun ? 'Would publish' : 'Published'} ${applied} phrase(s) from ${email}, ${withAudio} with a recording.`)
if (!dryRun) console.log('Next: npm run check-content, then commit content/ and public/audio/ and push to deploy.')
