import { useState } from 'react'
import { useApp, type SyncStatus } from '../state'

const STATUS: Record<SyncStatus, string> = {
  idle: '',
  syncing: 'Saving…',
  saved: '✓ Progress saved to your account',
  offline: 'Offline — will save when you reconnect',
  error: "Couldn't save right now — will retry",
}

/** Passwordless sign-in with a 6-digit email code (links would open Safari instead of the home-screen app). */
export function Account() {
  const { accountsEnabled, email, syncStatus, sendCode, verifyCode, signOut, deleteAccount } = useApp()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [addr, setAddr] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!accountsEnabled) return null

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await fn() } catch (e) { setError((e as Error).message || 'Something went wrong') } finally { setBusy(false) }
  }

  if (email) {
    return (
      <section className="rounded-2xl border-2 border-swan p-4 text-sm text-wolf">
        <h2 className="mb-1 text-base font-black text-eel">Your account</h2>
        <p className="mb-1 break-all font-bold text-eel">{email}</p>
        <p role="status" className={`mb-3 font-bold ${syncStatus === 'error' ? 'text-cardinal' : 'text-feather-dark'}`}>{STATUS[syncStatus]}</p>
        <div className="space-y-2">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(signOut)}>Sign out</button>
          <button
            type="button"
            className="btn btn-ghost text-cardinal"
            disabled={busy}
            onClick={() => confirm('Delete your account and all saved progress and recordings? This cannot be undone.') && run(deleteAccount)}
          >
            Delete account
          </button>
        </div>
        {error && <p role="alert" className="mt-2 font-bold text-cardinal">{error}</p>}
      </section>
    )
  }

  return (
    <section className="rounded-2xl border-2 border-sky bg-sky/5 p-4 text-sm text-wolf">
      <h2 className="mb-1 text-base font-black text-eel">Save your progress</h2>
      <p className="mb-3">Create a free account to keep your streak, XP and recordings safe and use them on any device. No password needed.</p>
      {step === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); run(async () => { await sendCode(addr); setStep('code') }) }} className="space-y-2">
          <label className="block">
            <span className="text-sm font-bold text-eel">Email</span>
            <input className="field" type="email" required autoComplete="email" inputMode="email" value={addr} onChange={(e) => setAddr(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-sky" disabled={busy || !addr}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(() => verifyCode(addr, code)) }} className="space-y-2">
          <label className="block">
            <span className="text-sm font-bold text-eel">6-digit code sent to {addr}</span>
            <input
              className="field text-center text-2xl font-black tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <button type="submit" className="btn btn-green" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Sign in'}</button>
          <button type="button" className="w-full py-2 font-extrabold uppercase text-sky" onClick={() => { setStep('email'); setCode(''); setError('') }}>
            Use a different email
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 font-bold text-cardinal">{error}</p>}
    </section>
  )
}
