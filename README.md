# Voxilizer

Design your vocal tone before you sing it. Write a vocal line, choose the grit, growl and twang for
every note, and hear it without spending your voice. Then train toward it, one healthy stage at a time.

## Resuming the project (new person, new Claude account)

Read `HANDBOOK.md` first: it has the product, every decision, the current status and the next steps.
Then `CLAUDE.md` (technical summary), `ROADMAP.md`, and `docs/cvt/` (the singing method the app
follows). A good first message to a new AI session:

> "I'm continuing Voxilizer. Read HANDBOOK.md, CLAUDE.md, ROADMAP.md and docs/cvt in the repo, run
> the checks, then continue with the next roadmap step."

Not in git on purpose: `apps/web/.env.local` (secrets) and `sources/` (copyrighted CVT material and
personal recordings, on the founder's PC). The handbook (§1) says what each holds.

## Where the code lives

- GitHub: [ryanamey/voxilizer](https://github.com/ryanamey/voxilizer). The `main` branch is the latest working version.
- The founder's working copy: `C:\Users\monau\OneDrive\Desktop\Voxilizer`.

## Run it

Requires Node 20.9+ (22 recommended, see `.nvmrc`) and pnpm 10.

1. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the values from the Neon
   **development** branch (connection string, Neon Auth URL) plus a random cookie secret.
2. Then:

```bash
pnpm install
pnpm db:migrate   # create the tables on the development database
pnpm dev          # http://localhost:3000
```

Checks (CI runs all of these):

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test                    # engine + web unit tests
pnpm build
pnpm --filter web test:e2e   # Playwright; set E2E_AUTH=1 to include the real sign-up flow
```

## Layout

- `apps/web`: the Next.js app
- `packages/engine`: the sound engine (pure TypeScript)
- `reference/grit-lab.html`: the original prototype, open it in a browser to compare sounds
- `docs/cvt/`: notes on Complete Vocal Technique, the method behind Grit Lab's rules
- `scripts/calibration/`: the script used to measure CVT recordings when tuning the synth

## Deploying on Vercel

Import the repository and set the project's **Root Directory** to `apps/web`. Vercel detects pnpm
and the workspace automatically. Add the **production** branch values as environment variables in
Vercel, run the migrations against production once, and add the domain to Neon Auth's trusted domains.
