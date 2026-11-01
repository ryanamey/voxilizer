# Voxilizer Handbook

This is the single document to read before working on Voxilizer, from any account, with any assistant
or developer. It records **what we're building, why, every decision made so far, and exactly how to
resume**. `CLAUDE.md` is the short technical summary; this is the full story.

Last updated: 2026-10-28 · Status: MVP steps 1–3 done (website, accounts, dashboard, Grit Lab) and
Grit Lab follows Complete Vocal Technique (CVT), current edition (see §8).

---

## 1. Resuming the project (start here)

**If you're a new Claude session (or any AI assistant):**

1. Clone the repo and read, in order: this file → `CLAUDE.md` → `ROADMAP.md` → `docs/cvt/`
   (`updates-since-2012.md` first, then `reading-notes-2012.md`). The CVT notes are the method the
   Grit Lab rules follow; `packages/engine/src/cvt.ts` is their code.
2. Set up environment variables: copy `apps/web/.env.example` to `apps/web/.env.local` and fill it in
   with the **development** branch values from Neon (see §7, "Environments").
3. Install, migrate and verify the baseline before changing anything:
   ```bash
   pnpm install
   pnpm db:migrate   # applies drizzle/ migrations to the development database
   pnpm format:check
   pnpm lint
   pnpm typecheck
   pnpm test         # engine + web unit tests
   pnpm build
   pnpm --filter web test:e2e   # Playwright (needs a build first)
   pnpm dev          # http://localhost:3000
   ```
4. Open `reference/grit-lab.html` in a browser. It's the original prototype and the reference for
   how every effect should sound and how the editor should feel.
5. Pick up the first unchecked item in `ROADMAP.md`. Section 9 below has the plan for the next steps.
6. When you finish a step: tick it in `ROADMAP.md`, update §8 of this handbook, and commit.

**Suggested first message for a new session:**

> "I'm continuing Voxilizer. Read HANDBOOK.md, CLAUDE.md and ROADMAP.md in the repo, run the checks,
> then continue with the next roadmap step."

**Who's who:** the founder is the product owner, architect and "the ears" (a musician who judges
whether a sound is right). The AI assistant writes the code. There is no other team yet, so keep
tooling minimal and explain decisions in plain language.

**Things that live outside the repo** (private to the original Claude account or the founder's PC;
their content is summarised in the repo so nothing depends on them):

- Research doc "The Science of Healthy Vocal Distortion" (Claude Docs artifact). Summary in §3.
- Grit Lab prototype artifact. A full copy is in `reference/grit-lab.html`.
- Claude Project "Distortion Vocal" (original account): copies of this handbook and the CVT notes.
  The repo versions in `docs/cvt/` are the source of truth.
- **The founder's PC:** `C:\Users\monau\OneDrive\Desktop\Voxilizer` is the working copy. Its
  `sources\` folder is git-ignored on purpose (copyrighted CVT material and personal recordings):
  - `sources\CVT\Book`: the CVT 2012 book PDF (scanned, no text layer) and the Sound Library mp3s
    (`CVT F 008` = female example 8, `CVT M 008` = male example 8).
  - `sources\CVT\App`: a partial text + screenshot capture of the CVT iPhone app.
  - `sources\me`: the founder's own material (so far: screenshots of the app's "Updates since
    2012" chapter; later: range, mode recordings, reference songs).
    A new session can ask the founder to attach files from there, or link the Claude desktop app to
    that folder. Don't extract audio from the CVT app (it's protected); the book's Sound Library is fine
    for calibration (`scripts/calibration/feat.py`).
- Secrets: Neon connection strings and the Neon Auth URL live in `apps/web/.env.local` on the
  founder's PC (development branch) and in Vercel env vars (production). Never in git.

**If you're a new Claude account:** the founder brings the repo (GitHub, or a git bundle file),
the `.env.local` values, and links the PC folder if `sources\` is needed. Nothing else is required.

---

## 2. The product

**One line:** Voxilizer lets singers design their vocal tone before they sing it, then train toward
it safely.

**The problem.** When working on a song, singers don't know where to put grit, growl or other effects.
They find out by singing the same phrase over and over with different settings. That burns hours of
high-effort, often distorted singing, which leads to fatigue and possible damage, often with nothing
gained. The founder has this problem himself.

**The solution.**

1. **Write the vocal line in a piano roll.** No staff notation (decided: a piano roll is easier and
   more practical for most singers). Each note gets a pitch, a length and a **vowel** (A E I O U).
   Typed lyrics were considered and dropped in favour of vowels per note.
2. **Shape the tone with handles:**
   - carrier **mode**: Neutral, Curbing, Overdrive, Edge
   - **effect**: creak, rattle, growl, grunt, with an amount 0–100
   - **false-fold distortion**: 0–100 (rock grit)
   - vocal tract: **larynx height**, **twang**, **air**, voice type (lower/higher)
     The song has one tone; any selection of notes can **override** it.
3. **Hear it instantly** through a synthesised voice. Experimenting costs zero vocal effort.
4. **See the load.** Every note shows its training stage (0–4). The song shows sung time, the share
   with effects, the heaviest stage, and warnings such as more than 6 s of rough singing without a
   clean note to recover on.
5. **Then train toward it** with staged lessons, and later record attempts and compare them to the
   designed target.

**Audience:** singers first, starting with rock/metal/soul singers who use rough effects. Possibly
coaches and producers later, then everyone.

**Principles that must not be broken:**

- The app never tells someone their technique is safe and never diagnoses. It flags warning signs
  and refers to a laryngologist (ENT with stroboscopy) or a voice speech-language pathologist.
- The synthesised preview shows a direction to aim for, not a sound to force. Copy should discourage
  pushing the voice to imitate it.
- Recordings stay on the user's device unless they explicitly choose to upload.
- Voice-cloning features only ever apply to the user's own voice. Reference recordings of other
  artists are analysed, never stored or redistributed.

---

## 3. Research summary (the science the product rests on)

**Core finding.** Healthy intentional distortion is a clean true-vocal-fold tone **plus an added
vibration source above the folds**. In imaging studies of trained singers the true folds keep
vibrating regularly underneath; mean pitch and mean contact don't change, only variability and noise
rise (McGlashan, Sayles & Sadolin 2013; Zangger Borch et al. 2004). Unhealthy distortion is noise
made by squeezing or slamming the true folds themselves.

**Where each effect comes from** (Complete Vocal Technique "levels"; Aaen, McGlashan & Sadolin 2017–2025):

| Level | Structure                                               | Effects                                                         |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------- |
| 1     | True vocal folds                                        | creak / vocal fry, air added, fry scream (highest risk)         |
| 2     | False (ventricular) folds                               | distortion / grit, false-cord scream, throat-singing undertones |
| 3     | Arytenoids, cuneiforms, aryepiglottic folds, epiglottis | growl, rattle, grunt                                            |
| 5     | Soft palate, uvula, tongue root                         | uvula / back-tongue rattle                                      |

**Acoustic signatures the engine models:**

- Growl and undertones = **sub-harmonic at half the pitch** (period doubling). Tested in the engine.
- Grit = broadband noise between harmonics (lower harmonics-to-noise ratio).
- Twang = boosted ~3 kHz "singer's ring" from aryepiglottic narrowing.

**Key studies** (full citations in the research doc):
Titze 1998 · Zangger Borch, Sundberg et al. 2004 · McGlashan & Sadolin 2008 · McGlashan, Sayles &
Sadolin 2013 · Guzman et al. 2013 · Bailly et al. 2014 · Moisik & Esling 2014 · Aaen et al. 2017–2025
(incl. the 2025 ASHA supraglottic taxonomy) · University of Utah / Stark et al. 2024 (deathcore singer
Will Ramos: healthy folds, extreme supraglottic movement) · Perta, Zhang et al. 2026 (an
_uncontrolled_ angry scream injured a trained singer's folds in one session, unlike trained belt) ·
Day, Tempesta, Howell, Aaen et al. 2026 (rough effects need higher threshold pressure; growl uses
more airflow).

**Evidence caveats.** Samples are small (10–32 trained singers) and much of the effect-mapping comes
from one group linked to Complete Vocal Institute. Almost no data on untrained, self-taught or
teenage singers, fry screams or inhale screams.

**Training stages** (encoded in `stageOf()`; prototype heuristics for coaches to refine):

| Stage | Content                                                                                                                               | Gate to move on                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0     | Foundations: regulated breath, false-fold retraction (silent laugh), clean onsets, a stable carrier mode, isolation, neck/jaw release | All six foundation tests pass                 |
| 1     | True-fold texture: creak, air added                                                                                                   | Clear voice next morning                      |
| 2     | False-fold family: distortion, false-cord scream, undertones                                                                          | Effect on/off without the clean note changing |
| 3     | Aryepiglottic family: growl, rattle, grunt                                                                                            | Each effect passes alone, no hoarseness       |
| 4     | Integration: stacking sources, high amounts                                                                                           | Stamina for a full set                        |
| 5     | Advanced, with a coach: fry scream, inhale screams, hybrid high screams                                                               | —                                             |

Hoarseness or pain means step back a stage. The universal learning loop for any effect: find it
silently → unvoiced → spoken → on a carrier (clean → effect → clean) → expand one variable at a time
→ apply in a song → check recovery 5 minutes later and the next morning.

**Health rules for the app:** dose effect time like strength training (start 5–10 min, add 2–3 min a
week only if the voice is clear next morning); interleave clean/SOVT reps; daily check-in (speaking
voice, soft high note, pain); two weeks of hoarseness or any pain → referral screen.

---

## 4. Decisions log

| Date       | Decision                                                                                      | Why                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2026-10-27 | Research first, then an app with a step-by-step path                                          | Founder's original goal: a scientific, healthy approach to all distortions                                     |
| 2026-10-27 | Add a sound designer with handles                                                             | Lets singers hear a target tone without singing                                                                |
| 2026-10-27 | "My voice" mode (record a take, add effects via LPC) prototyped                               | Make previews sound like the user; kept as a later feature                                                     |
| 2026-10-28 | Core workflow = design the song's tone before singing it                                      | Solves the founder's real problem: trial-and-error that burns the voice                                        |
| 2026-10-28 | Notation input with a vowel per note instead of lyrics                                        | No vocal effort at all; precise per-note control                                                               |
| 2026-10-28 | **Piano roll, not staff**                                                                     | Easier and more practical (founder confirmed)                                                                  |
| 2026-10-28 | Planned: one-time **voice profile** (5 vowels)                                                | So synthesised playback sounds roughly like the singer                                                         |
| 2026-10-28 | Stack: Next.js, shadcn, Neon + Better Auth, Vercel, Sentry, Zod + Drizzle, Zustand            | Founder's preference; modern and well supported                                                                |
| 2026-10-28 | Audio: Web Audio + AudioWorklet, Web Worker rendering, versioned Zod song format              | Standard, robust browser audio architecture                                                                    |
| 2026-10-28 | **Engine in TypeScript first, Rust/WASM later**                                               | Two-person team; founder can own TypeScript; port only when live feedback/native apps/plugins need it          |
| 2026-10-28 | Add other tools only when a step needs them                                                   | Every tool is maintenance for a tiny team                                                                      |
| 2026-10-28 | Name: **Voxilizer** (working name)                                                            | Coined, all domains free, no direct conflict found                                                             |
| 2026-10-28 | Repo `ryanamey/voxilizer`, pnpm workspace `apps/web` + `packages/engine`                      | Simple monorepo; engine isolated for testing and future porting                                                |
| 2026-10-28 | **Neon Managed Better Auth** (Neon Auth) instead of self-hosted Better Auth                   | Less auth code for a two-person team; users still live in our Neon database (`neon_auth` schema)               |
| 2026-10-28 | One Neon project, branches `production` and `development`                                     | Standard Neon setup; each branch has its own database, Auth URL and users                                      |
| 2026-10-28 | Website + client portal (sign-in/up) + dashboard; Grit Lab is the first section               | Founder's spec for the first full build                                                                        |
| 2026-10-28 | Songs saved to the account in Postgres (JSON column, versioned schema)                        | Melodies persist across devices; schema validated with Zod on every save and load                              |
| 2026-10-28 | **For now the app is for the founder's own voice; CVT is the method.** Other methods later    | Founder's call; personal use makes CVT licensing a later question                                              |
| 2026-10-28 | Song format v2: per-tone CVT volume 1–10, Neutral-only air, female/male singer, 11 CVT vowels | CVT's rules depend on volume, sex-specific pitch limits and exact vowels                                       |
| 2026-10-28 | CVT rules engine (`packages/engine/src/cvt.ts`) checks every note, with one-click fixes       | 95% of problems are mode misuse (CVT); designs should be singable in the centre of the mode                    |
| 2026-10-28 | Synth modes calibrated against the CVT Sound Library (H1–H2, spectral tilt, 3 kHz ring)       | The synth should sound like the modes it names                                                                 |
| 2026-10-28 | Follow the current CVT edition over the 2012 book: density, falsetto, Highway/Byway           | The founder supplied the app's "Updates since 2012" chapter; the app is the living source                      |
| 2026-11-01 | Vocal Tuner: piano-based pitch trainer, detection in the pure engine (McLeod NSDF)            | Founder's request; pitch accuracy underlies every mode and effect; pure detector is testable and ports to WASM |

**Names considered and rejected:** VoxDesign (voxdesign.com taken; "Vox" overlaps the VOX amp brand),
VocalDesign (Roland sells "Vocal Designer"), VoxShape, VoxSketch, VoxPalette, Raspwell, Supravox,
FalseFold, Vocalyre/VoxLyre (lyrebird idea), VoxTrill, Vocanary.

---

## 5. Branding and legal to-dos

- [ ] Register **voxilizer.com**, **voxilizer.app** and **voxiliser.com** (all free on 2026-10-28).
- [ ] Trademark search (CIPO for Canada, USPTO for the US) before spending on branding.
- [ ] Decide whether to license Complete Vocal Technique terms (Neutral, Curbing, Overdrive, Edge) or
      rename the modes with neutral, physiology-based names.
- [ ] Recruit an advisor: laryngologist or voice SLP.
- [ ] Privacy policy compliant with PIPEDA (Canada) and GDPR before storing any recordings.

---

## 6. Architecture

```
voxilizer/
  .github/workflows/ci.yml        format, lint, typecheck, unit tests, build, e2e on every push/PR
  apps/web/                       Next.js 16 app (App Router, Turbopack, Cache Components, React 19)
    next.config.ts                COOP/COEP headers (cross-origin isolation)
    drizzle.config.ts, drizzle/   database migrations (Drizzle Kit)
    public/worklets/player.js     AudioWorklet playback processor (plain JS)
    e2e/                          Playwright tests
    src/
      proxy.ts                    redirects signed-out users away from /dashboard (Next 16 "proxy")
      app/(marketing)/            public website: landing page, header, footer
      app/(auth)/                 /sign-in, /sign-up, server actions (sign in/up/out)
      app/api/auth/[...path]/     Neon Auth route handler
      app/dashboard/              dashboard layout (sidebar) + sections; grit-lab/ (+ song actions), vocal-tuner/
      components/ui/              shadcn/ui components (copied, owned by us)
      components/dashboard/       sidebar, nav config, user menu, placeholders
      components/grit-lab/        Grit Lab: store, tone designer, scopes, piano roll, melody studio, song bar
      components/vocal-tuner/     Vocal Tuner: tuner.ts (pure state machine), 7-octave keyboard, mic + reference
                                  tone (audio.ts), pitch trail
      audio/                      AudioEngine host + render worker
      db/                         Drizzle schema + client (Neon HTTP driver)
      lib/                        env validation, auth server/client, DAL (current user), songs repo, validation
  packages/engine/                @voxilizer/engine, pure TypeScript
    src/constants.ts              modes, effects, vowels, voices (the sound's numbers)
    src/song.ts                   versioned Zod song schema + example song
    src/render.ts                 source–filter melody synthesis
    src/voice.ts                  "my voice": LPC analysis + effects on a recorded take
    src/spectrum.ts               FFT + magnitude spectrum for the scopes
    src/load.ts                   training stages, load analysis, designer notes
  reference/grit-lab.html         original prototype
```

**Auth and security:**

- Neon Auth handles passwords and sessions. The browser talks to `/api/auth/*`, which proxies to Neon
  and sets the session cookie (signed with `NEON_AUTH_COOKIE_SECRET`).
- `proxy.ts` redirects unauthenticated requests to `/sign-in`. Pages and server actions **also** check
  the session through `lib/dal.ts` (`requireUser`), so authorization never depends on the proxy alone.
- Every song query is scoped by `user_id` in `lib/songs.ts`; ids are validated as UUIDs; song JSON is
  validated with the engine's Zod schema on save and load.
- Environment variables are validated on first use (`lib/env.ts`); the app builds without them.
- With Cache Components, anything that reads the session renders inside `<Suspense>`; avoid
  `useSearchParams` in large client trees (it forces client-only rendering and left a duplicate
  hidden copy of Grit Lab during development); read `window.location` in an effect instead.

**Threads:** UI on the main thread → render request to the **Web Worker**, which runs the engine at
the AudioContext's sample rate → samples transferred to the **AudioWorklet**, which plays them and
reports position ~30×/s for the playhead.

**Engine model (render.ts):**

- Source: one Rosenberg-style glottal pulse per cycle; mode sets open quotient, closing sharpness,
  spectral tilt, gain and aspiration.
- Effects: false folds → noise burst after each closure; growl → flutter every other cycle
  (sub-harmonic); creak → irregular long, weak pulses; rattle → random wet bursts; grunt → slack
  folds plus gated turbulence.
- Filter: five cascaded formant resonators (vowel × voice scale × larynx × twang) plus a parallel
  3 kHz ring resonator; DC-blocked; gentle levelling; normalised to 0.85 peak.
- Melody: control values per 64-sample block, smoothed between notes (pitch glide ~30 ms, formants
  ~45 ms, effects ~50 ms), vibrato blooming after 0.35 s on held notes, re-articulation dip on
  repeated pitches. Seeded RNG makes renders deterministic.

**Rules:**

- Keep `packages/engine` free of DOM and React code.
- Changing anything in `constants.ts` or `render.ts` changes how every song sounds: do it deliberately
  and say so in the commit.
- Bump the song `version` on breaking schema changes and keep old versions loadable.
- Next.js 16 has breaking changes: read `apps/web/AGENTS.md` and `node_modules/next/dist/docs/`
  before using unfamiliar APIs.
- Fonts are self-hosted (`geist` package); with COEP on, any cross-origin resource needs CORP/CORS.

---

## 7. Stack

| In use                                                                                                                                                                                                                                               | Add when a step needs it                                                                                                                   | Later                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui (Radix), Neon Postgres + Drizzle, Neon Auth (`@neondatabase/auth`), Zod, react-hook-form, Zustand + zundo, next-themes, sonner, Vitest, Playwright, Prettier, GitHub Actions, Vercel | Sentry (DSN placeholder already in env), Stripe, Resend (email verification, password reset), Cloudflare R2 (recordings), ONNX Runtime Web | Rust → WASM engine, PWA (Serwist), Capacitor mobile apps, nih-plug DAW plugin, GPU service for neural voice rendering |

Note: `@neondatabase/auth` is still published as a **beta** (0.7.0-beta at the time of writing). Pin it
and read its changelog before upgrading.

**Environments:**

| Neon branch   | Used by                          | Where the values live                               |
| ------------- | -------------------------------- | --------------------------------------------------- |
| `production`  | the live site on Vercel          | Vercel → Project → Settings → Environment Variables |
| `development` | local development, tests, Claude | `apps/web/.env.local` (git-ignored)                 |

Each branch has its own connection string, Auth URL and users. Production gets its own
`NEON_AUTH_COOKIE_SECRET`. Migrations are generated with `pnpm db:generate`, applied to
development with `pnpm db:migrate`, and applied to production only after testing.

**Deploying on Vercel:** import the repo, set **Root Directory = `apps/web`**, add the production
environment variables, then run the migrations against the production branch once
(`DATABASE_URL=<production url> pnpm --filter web exec drizzle-kit migrate`). In Neon Auth settings,
add the production domain as a trusted domain.

---

## 8. Current status

**Done:**

- Step 1: workspace, engine, worker rendering, AudioWorklet playback, COOP/COEP headers.
- Step 2–3 (merged): public **landing page**; **sign-up / sign-in / sign-out** with Neon Auth
  (client + server validation, safe redirects); **dashboard** with sidebar (Overview, Grit Lab, and
  "coming soon" Songs, Lessons, Progress, Voice Profile, Settings), user menu, light/dark theme;
  **Grit Lab** fully ported: tone designer (presets, carrier, effects, tract, scopes, recipe, stage
  readout), **My voice** (record or upload, effects applied to your take), **melody studio** (piano
  roll, vowels, per-note overrides, live load map, preview), **undo/redo**, and **songs saved to the
  account** (new / open / save / delete, unsaved-changes warning). Overview lists recent songs.
- **CVT update (2026-10-28):** song format v2 (volume 1–10 per tone, audible air only in Neutral,
  female/male singer, the 11 CVT vowels, range C2–C6; v1 songs migrate on load). `cvt.ts` checks each
  note: Overdrive's pitch ceiling, vowels per mode in the high part (with the "sung as" vowel), each
  mode's volume range, air in metallic modes, dark colour in Edge/distortion, and mode changes between
  neighbouring notes (shared vowels, assisting mode). Grit Lab shows the checks with fixes, outlines
  problem notes in the piano roll, and lists them. Presets rewritten to sit in the centre of their modes.
  Mode constants calibrated against CVT M 055/056/072/077/097/102/120/127.
- **CVT current edition (2026-10-28):** optional `density` on each tone (fuller / reduced / falsetto;
  Curbing is always reduced, falsetto is Neutral only; old songs default to the mode's usual density,
  so no format bump). Checks: Overdrive top for women D5 (was E♭5), Curbing vowels UH/O/OO (I is a
  tip), no Curbing for women above C6, density-aware volume ranges (reduced metal 4–7; Neutral up to 7
  in the middle part with twang), Highway/Byway transition tips, vocal-break tips for falsetto; the
  assisting-mode rule is gone. Synth: reduced density opens the folds a little and halves the ring;
  falsetto is breathy-thin with no ring. UI: density picker in the tone designer and note inspector.
- **Vocal Tuner (2026-11-01):** new dashboard section. A 7-octave piano (C1–B7): click a key (it
  turns green, and optionally plays), sing it. The sung note shows live; a wrong note turns red with
  an arrow and "N semitones lower/higher" toward the target, plus "right note, wrong octave" and
  cents-sharp/flat hints. Holding within the tolerance (±10 / ±25 / ±40 cents) for 2 s locks the
  note. A 6-second pitch trail shows the voice against the target. Pitch detection is
  `packages/engine/src/pitch.ts` (McLeod NSDF with a low-pass prefilter and a spectral octave guard,
  ~3 ms per frame); the microphone is read through an AnalyserNode with browser voice processing off,
  and muted while the reference note plays. Verified in Chromium with a fake microphone.
- Tests: 41 engine tests, 17 web unit tests, 3 Playwright tests (+1 full auth flow behind `E2E_AUTH=1`).
- Verified in headless Chromium: pages render in light and dark, the dashboard redirects to sign-in,
  form validation works, the piano roll adds / deletes / undoes notes, playback runs.

**Not yet verified live:** sign-up and sign-in against Neon, and saving songs. Claude's sandbox can't
reach `*.neon.tech`. First run on the founder's PC: `pnpm db:migrate`, then sign up at
`/sign-up`.

**GitHub and delivery:** the code goes to GitHub at the repository named in `README.md` ("Where the
code lives"). If a session can't push (the Claude GitHub app isn't installed for that repository),
it delivers a **git bundle** to the founder's PC instead, and the founder pulls it and pushes:

```bash
git pull <file>.bundle main
git push origin main
```

---

## 9. Next steps

0. **CVT, rest of the app:** density is in. Still to read: the app's Vocal Modes, Transitions, Effects
   and Sound Colour chapters (5 colour grades Lightest–Darkest, the 10 main effects and full
   distortion, onset, support balance). Then the founder's own voice: range, mode recordings, goals
   (`sources\me`), and calibrate falsetto and reduced density against recordings.
1. First live run: migrate, sign up, save a song; fix anything Neon-specific.
2. Deploy to Vercel (production branch values, trusted domain, migrations).
3. Sentry (errors) once a DSN exists.
4. **Songs** section: list, rename, duplicate, delete, export a tone sheet.
5. **Voice profile** (roadmap step 4), then **record and compare** (step 5), then **lessons** (step 6).
6. Email verification and password reset (needs Resend), Google sign-in.

---

## 10. Open questions

- Final name and trademark clearance.
- License CVT mode names or rename them? (Not urgent while the app is for the founder's own use.)
- First paying user: self-taught singers, or coaches with students?
- Monetisation model (subscription, per-coach seats, one-off).
- How realistic must playback be before launch? (Synth now; voice profile in step 4; neural later.)
