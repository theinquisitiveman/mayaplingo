# MayapLingo — learn Kapampangan

A Duolingo-style, installable web app (PWA) for learning **conversational Kapampangan**, the language of Pampanga.
It's built for heritage learners and puts speaking and listening first. It's a sister app to
[DariLingo](https://github.com/theinquisitiveman/gap) and works the same way, with its own repo, site and Supabase project.

## Run it
```bash
npm install
npm run dev        # http://localhost:5174, also on your LAN (--host) for testing on an iPhone
npm test           # unit tests (answer checking, streaks, hearts, review queue, corrections)
npm run build      # validates content, type-checks, builds dist/ with the service worker
```
Deploy `dist/` to any static HTTPS host (Vercel, Netlify, Cloudflare Pages). On iPhone: open in Safari →
Share → **Add to Home Screen**. It runs full-screen and works offline.

## Accounts & saved progress
Learners can use the app as a guest, with progress saved on the device. They can also create a free account from **Me**
or the banner on the Learn tab. Sign-in is passwordless: they enter their email and type the 6-digit code they're sent.
It's a code rather than a link because links open Safari, not the home-screen app. Guest progress carries into the new
account. Progress, settings, fixes and recordings then sync to every device they sign in on.

Backend: [Supabase](https://supabase.com) (Postgres + Auth + Storage). Everything is in `supabase/`:
- `migrations/…_user_state.sql`: one row per learner plus a private `recordings` bucket. **Row-level security** means
  each account can only read or write its own row and its own `<user id>/` folder, and signed-out visitors see nothing.
  The migration also sets size and type limits (512 KB of state, audio files only, under 2 MB each), and
  `delete_my_account()` lets learners delete their own account.
- `config.toml` + `templates/code.html`: email-code sign-in, codes expire after 10 minutes, at most one code per
  email per minute.

Signing out or deleting the account wipes the device. Production builds ship a Content Security Policy that only
allows scripts from the site itself and network calls to the Supabase project.

```bash
npx supabase start          # local Supabase in Docker (sign-in emails appear at http://127.0.0.1:54324)
npm run dev                 # uses .env.local → local Supabase
npm run test:security       # 27 checks: users can't read or change each other's data or recordings, etc.
```

### Going live
1. Create a project at supabase.com, then: `npx supabase login && npx supabase link --project-ref <ref>`
   then `npx supabase db push && npx supabase config push`.
2. **Email:** Supabase's built-in mailer only sends to your own team's addresses, so add custom SMTP (for example
   Resend) under Authentication → SMTP before real learners sign up.
3. In the GitHub repo, add variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (Project Settings → API), then
   re-run the deploy workflow.

## Content
All lessons live in `content/course.json`. Exercises are generated from each lesson's phrases, so editing a phrase
updates every exercise that uses it. `npm run check-content` validates the file.

Phrases use the modern "K" spelling (*Kapampangan*, *kumusta*) rather than the older Spanish-style spelling
(*Capampangan*, *cumusta*). Common variants are accepted as answers through each phrase's `alts`. Every phrase
starts as `"status": "draft"`. Drafts were written from general knowledge and partly checked against the sources
listed in the file. **They have not been verified by a native speaker yet.**

## Pronunciation audio
Every phrase's audio is labelled in the app by where it came from:
- **Native audio:** real speakers. This includes recordings published from reviewers' accounts (`publish-account`)
  and the five CC BY-SA recordings by *lgriot* on [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Kapampangan_pronunciation)
  (*dyip, ngeni, obra, siyam, siyempre*), credited in each item's `audioCredit`.
- **Computer voice:** generated with Meta's [MMS](https://huggingface.co/facebook/mms-tts-pam) Kapampangan voice.
  A take is kept only if Meta's separate MMS speech recogniser transcribes it about as accurately as it does native
  speakers. Phrases with no passing take get no audio and are listed for a human recording.

To voice new phrases (it never overwrites native audio):
```bash
uv run --python 3.12 --with torch --with transformers --with scipy --with soundfile scripts/generate-audio.py
npm run check-content
```
The MMS models are CC BY-NC 4.0, so they're fine for a free app. Replace the computer voices before charging for it.

## The correction loop ("fix it and learn from it")
1. **In the app**, anyone can tap **🚩 Fix this phrase** after any exercise, or ✎ in the **Phrases** tab, to correct the
   spelling, meaning or notes, add accepted alternatives, and **record the real Kapampangan pronunciation**.
   Fixes apply immediately in that person's lessons, and recordings replace the missing audio.
2. When a word-bank answer is marked wrong but is really fine, **✓ My answer is also correct** adds it as an
   accepted alternative.
3. **Me → Share my fixes** exports a `mayaplingo-corrections-*.json` file (with recordings) through the iOS share sheet.
4. The maintainer merges it for everyone:
   ```bash
   npm run apply-corrections -- ~/Downloads/mayaplingo-corrections-2026-11-20.json
   npm run check-content && git add content public/audio && git commit
   ```
   That updates `course.json`, writes audio to `public/audio/`, marks the items `reviewed` and credits the reviewer.
   Reviewers can also **import** each other's files in the app.

**Publishing straight from an account** (the easier route for the course owner): record and fix phrases in the app
while signed in, then run
```bash
npm run publish-account -- you@example.com --dry-run   # preview
npm run publish-account -- you@example.com             # write content/ + public/audio/
npm run check-content && git add content public/audio && git commit -m "Publish recordings" && git push
```
This reads that account's fixes and recordings with the project's secret key, which it gets from the logged-in
Supabase CLI and never saves. It updates the course for everyone and leaves the account unchanged. Recordings are
cached on each phone the first time they play, not downloaded up front.

## Layout
```
content/course.json        units → lessons → phrases
src/lib/                   pure logic: content, exercises, progress (XP/streak/hearts/SRS), corrections, audio, db
src/screens/               Path, Lesson, Practice, Phrasebook, Profile
src/exercises/             Choice (meaning/listen/target), WordBank, Match, Speak
src/components/            CorrectionSheet, Phrase, Mascot (Parul the star lantern)
scripts/                   check-content, apply-corrections, make-icons
```
