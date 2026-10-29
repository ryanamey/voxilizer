# Voxilizer — project context

Read this first, then HANDBOOK.md for the full story and `docs/cvt/` for the singing method (CVT)
that Grit Lab's rules follow. It carries the decisions and context that previous sessions made, so any session
(Claude or a human developer) can continue the work.

## What we're building

A web app for singers to **design their vocal tone before they sing it**, then train toward it healthily.

- The singer writes a vocal line in a **piano roll** (no staff notation), gives each note a **vowel**
  (the 11 CVT vowels), and sets the tone: CVT **mode** (Neutral, Curbing, Overdrive, Edge), **density**
  (fuller, reduced, falsetto), **volume** 1–10, **effect**
  (creak, rattle, growl, grunt) with an amount, **false-fold distortion** 0–100, and vocal-tract
  settings (larynx height, twang, audible air in Neutral, female/male singer). `cvt.ts` checks every
  note against CVT's rules and offers fixes.
- The **song tone** applies to every note; selected notes can **override** it.
- Playback is synthesised, so experimenting costs the singer **zero vocal effort**. This is the
  product's core reason to exist: singers otherwise burn hours of voice trying tones by trial and error.
- Every note gets a **training stage** (0–4) and the song gets a **load map**: sung time, share with
  effects, heaviest stage, and warnings (e.g. more than 6 s of rough singing with no clean note to recover).

Planned next, in order: see `ROADMAP.md`.

## Research basis

The tone model and stages come from a research doc ("The Science of Healthy Vocal Distortion",
a Claude Docs artifact owned by the founder). Key facts the code relies on:

- Healthy distortion = a **clean true-fold tone plus an added supraglottic source** (false folds,
  aryepiglottic folds, arytenoids). Fry screams are the exception: the grit is on the true folds.
- Growl's acoustic signature is a **sub-harmonic at half the pitch** (period doubling); a test checks this.
- Stages: 0 foundations · 1 creak/air · 2 false-fold family · 3 aryepiglottic family (growl, rattle,
  grunt) · 4 combinations or very high amounts. `stageOf()` in the engine encodes these heuristics.
- The app must never claim a technique is safe or diagnose anything. It flags warning signs and
  refers to a laryngologist / voice SLP.
- Mode names are Complete Vocal Technique (CVT) terminology: license or rename before commercial launch.

## Architecture

```
apps/web                Next.js 16 (App Router, Turbopack, Cache Components), React 19, Tailwind v4, shadcn/ui
  src/app/(marketing)/  public website
  src/app/(auth)/       sign-in, sign-up (Neon Auth), server actions
  src/app/dashboard/    signed-in area; grit-lab/ is the first section
  src/components/grit-lab/  the Grit Lab UI (Zustand store + zundo undo)
  src/lib/              env (Zod), auth, DAL (requireUser), songs repository
  src/db/               Drizzle schema + client; migrations in apps/web/drizzle/
  src/proxy.ts          redirects signed-out users from /dashboard
  src/audio/            AudioEngine (main thread), render.worker.ts (Web Worker)
  public/worklets/      player.js — AudioWorklet playback (plain JS, no imports)
packages/engine         @voxilizer/engine — pure TypeScript sound engine, no DOM/React
reference/              grit-lab.html — the original prototype; the sound reference
```

Three threads, one job each: **UI** on the main thread · **rendering** in a Web Worker ·
**playback** in an AudioWorklet. The worker renders at the AudioContext's sample rate and transfers
the buffer to the worklet, which reports playback position ~30×/s.

- `packages/engine` must stay **pure**: functions in, `Float32Array` out. No browser APIs, no React.
  This keeps it testable in Node and portable to Rust/WASM later.
- Renders are **deterministic** (seeded RNG). Same song + seed = identical samples.
- The song format is a **versioned Zod schema** (`packages/engine/src/song.ts`). Bump `version` on any
  breaking change and keep old versions loadable.
- COOP/COEP headers are set in `next.config.ts` so the page is cross-origin isolated
  (SharedArrayBuffer available). Any cross-origin resource must send CORP/CORS headers.
- Fonts are self-hosted via the `geist` package (no runtime Google Fonts fetch).

## Stack decisions

In use: Next.js, TypeScript strict, Tailwind, shadcn/ui, Zod, react-hook-form, Zustand + zundo,
Neon Postgres + Drizzle, Neon Auth (managed Better Auth, beta package), Vitest, Playwright, Prettier,
GitHub Actions, Vercel.
Add when the step needs it: Sentry, Resend, Stripe, Cloudflare R2, ONNX Runtime Web.
Later: Rust → WASM port of the engine (for real-time feedback, native apps, a DAW plugin).

Neon branches: `production` (Vercel env vars only) and `development` (`apps/web/.env.local`, git-ignored).
Never commit secrets. Schema changes go through Drizzle migrations, applied to development first.

Team: the founder (product, architecture, and the ears) plus Claude (code). Keep tooling minimal.

## Conventions

- Next.js 16 has breaking changes from older versions. Read `apps/web/AGENTS.md` and the bundled
  docs in `node_modules/next/dist/docs/` before using an unfamiliar API.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the Playwright
  tests must pass before committing (CI runs the same).
- Every server action and page that touches user data calls `requireUser()` and validates input with
  Zod; song queries are always scoped by `user_id`.
- Cache Components: read the session inside `<Suspense>`; avoid `useSearchParams` in big client trees.
- Changing a number in `packages/engine/src/constants.ts` or `render.ts` changes how every song sounds.
  Do it deliberately and say so in the commit message.
- UI copy: plain, singer-facing language. Name things by what singers recognise.
