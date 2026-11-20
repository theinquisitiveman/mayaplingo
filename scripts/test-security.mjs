// End-to-end security check against a local Supabase (npx supabase start).
// Proves: sign-in by email code works; users can only see/change their own data and recordings;
// anonymous visitors see nothing; oversize writes are rejected; account deletion removes data.
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'

// Local by default. To check a hosted project, set SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY and
// SUPABASE_TEST_SECRET_KEY: test users are then created with the admin API (no inbox to read) and removed afterwards.
const REMOTE = !!process.env.SUPABASE_TEST_URL
const status = REMOTE
  ? { API_URL: process.env.SUPABASE_TEST_URL, PUBLISHABLE_KEY: process.env.SUPABASE_TEST_PUBLISHABLE_KEY, SECRET_KEY: process.env.SUPABASE_TEST_SECRET_KEY }
  : JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).replace(/^[^{]*/, ''))
const URL_ = status.API_URL, KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY, MAIL = status.MAILPIT_URL ?? status.INBUCKET_URL
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let failures = 0
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` (${extra})` : ''}`); if (!ok) failures++ }

async function signIn(email) {
  const sb = client()
  if (REMOTE) {
    const admin = createClient(URL_, status.SECRET_KEY, { auth: { persistSession: false } })
    const password = crypto.randomUUID()
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { sb, id: data.user.id }
  }
  const { error } = await sb.auth.signInWithOtp({ email })
  if (error) throw error
  // Read the code from the local mail catcher, as a user would from their inbox.
  let code
  for (let i = 0; i < 20 && !code; i++) {
    const list = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    const msg = list.messages?.[0]
    if (msg) {
      const full = await (await fetch(`${MAIL}/api/v1/message/${msg.ID}`)).json()
      code = full.Text.match(/\b(\d{6})\b/)?.[1]
      if (code && i === 0) console.log(`  email subject: "${full.Subject}"`)
    }
    if (!code) await new Promise((r) => setTimeout(r, 250))
  }
  if (!code) throw new Error(`no code emailed to ${email}`)
  const bad = await sb.auth.verifyOtp({ email, token: code === '000000' ? '111111' : '000000', type: 'email' })
  check(`wrong code is rejected for ${email}`, !!bad.error)
  const { data, error: e2 } = await sb.auth.verifyOtp({ email, token: code, type: 'email' })
  if (e2) throw e2
  return { sb, id: data.user.id }
}

const stamp = Date.now()
if (!REMOTE) await fetch(`${MAIL}/api/v1/messages`, { method: 'DELETE' }).catch(() => {})
const A = await signIn(`mayaplingo-test-alice.${stamp}@example.com`)
const B = await signIn(`mayaplingo-test-bob.${stamp}@example.com`)
check(REMOTE ? 'two test accounts created' : 'two accounts created via email code', A.id && B.id && A.id !== B.id)

// --- Table: user_state
const state = { progress: { xp: 42, completed: { 'u1-l1': 1 } }, settings: { reviewerName: 'test' }, corrections: {} }
let r = await A.sb.from('user_state').upsert({ user_id: A.id, ...state })
check('Alice saves her progress', !r.error, r.error?.message)
r = await A.sb.from('user_state').select('progress').eq('user_id', A.id).single()
check('Alice reads her progress back', r.data?.progress?.xp === 42)

r = await B.sb.from('user_state').select('*').eq('user_id', A.id)
check("Bob cannot read Alice's progress", !r.error && r.data.length === 0)
r = await B.sb.from('user_state').select('*')
check('Bob sees no rows but his own', !r.error && r.data.every((row) => row.user_id === B.id))
r = await B.sb.from('user_state').update({ progress: { xp: 0 } }).eq('user_id', A.id).select()
check("Bob cannot change Alice's progress", !r.error && r.data.length === 0)
r = await B.sb.from('user_state').insert({ user_id: A.id, ...state })
check('Bob cannot write a row as Alice', !!r.error)
r = await B.sb.from('user_state').upsert({ user_id: A.id, progress: { xp: 1 } })
check('Bob cannot overwrite Alice via upsert', !!r.error)
r = await A.sb.from('user_state').select('progress').eq('user_id', A.id).single()
check("Alice's data is unchanged", r.data?.progress?.xp === 42)

r = await client().from('user_state').select('*')
check('Signed-out visitors see nothing', !!r.error || r.data.length === 0, r.error?.message)

r = await A.sb.from('user_state').upsert({ user_id: A.id, progress: { junk: 'x'.repeat(600_000) }, settings: {}, corrections: {} })
check('Oversized writes are rejected', !!r.error)

// --- Storage: recordings
const audio = new Blob([new Uint8Array(1000)], { type: 'audio/mp4' })
r = await A.sb.storage.from('recordings').upload(`${A.id}/salaam`, audio, { upsert: true, contentType: 'audio/mp4' })
check('Alice uploads a recording', !r.error, r.error?.message)
r = await A.sb.storage.from('recordings').download(`${A.id}/salaam`)
check('Alice downloads her recording', !r.error && r.data.size === 1000)
r = await B.sb.storage.from('recordings').download(`${A.id}/salaam`)
check("Bob cannot download Alice's recording", !!r.error)
r = await B.sb.storage.from('recordings').list(A.id)
check("Bob cannot list Alice's recordings", !r.error && r.data.length === 0)
r = await B.sb.storage.from('recordings').upload(`${A.id}/evil`, audio, { contentType: 'audio/mp4' })
check("Bob cannot upload into Alice's folder", !!r.error)
r = await B.sb.storage.from('recordings').remove([`${A.id}/salaam`])
r = await A.sb.storage.from('recordings').download(`${A.id}/salaam`)
check("Bob cannot delete Alice's recording", !r.error)
r = await A.sb.storage.from('recordings').upload(`${A.id}/page`, new Blob(['<script>'], { type: 'text/html' }), { contentType: 'text/html' })
check('Non-audio uploads are rejected', !!r.error)
r = await A.sb.storage.from('recordings').upload(`${A.id}/big`, new Blob([new Uint8Array(3 * 1024 * 1024)], { type: 'audio/mp4' }), { contentType: 'audio/mp4' })
check('Recordings over 2 MB are rejected', !!r.error)
r = await client().storage.from('recordings').download(`${A.id}/salaam`)
check('Signed-out visitors cannot download recordings', !!r.error)

// --- Account deletion
await B.sb.from('user_state').upsert({ user_id: B.id, ...state })
r = await client().rpc('delete_my_account')
check('Signed-out visitors cannot call delete_my_account', !!r.error)
await A.sb.storage.from('recordings').remove([`${A.id}/salaam`])
r = await A.sb.rpc('delete_my_account')
check('Alice deletes her account', !r.error, r.error?.message)
const admin = createClient(URL_, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
r = await admin.from('user_state').select('user_id').eq('user_id', A.id)
check("Alice's saved state is gone", !r.error && r.data.length === 0)
r = await admin.auth.admin.getUserById(A.id)
check("Alice's login is gone", !!r.error || !r.data?.user)
r = await admin.from('user_state').select('user_id').eq('user_id', B.id)
check("Bob's data is untouched by Alice's deletion", !r.error && r.data.length === 1)
await B.sb.rpc('delete_my_account')

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll security checks passed')
process.exit(failures ? 1 : 0)
