# Voxilizer

Design your vocal tone before you sing it. Write a vocal line, choose the grit, growl and twang for
every note, and hear it without spending your voice. Then train toward it, one healthy stage at a time.

## Run it

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:3000, studio at /studio
pnpm test         # engine tests
pnpm typecheck
pnpm build
```

## Layout

- `apps/web`: the Next.js app
- `packages/engine`: the sound engine (pure TypeScript)
- `reference/grit-lab.html`: the original prototype, open it in a browser to compare sounds

Start with `HANDBOOK.md` (everything needed to resume the project), then `CLAUDE.md` and `ROADMAP.md`.

## Deploying on Vercel

Import the repository and set the project's **Root Directory** to `apps/web`. Vercel detects pnpm
and the workspace automatically.
