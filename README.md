# Voxilizer

Design your vocal tone before you sing it. Write a vocal line, choose the grit, growl and twang for
every note, and hear it without spending your voice. Then train toward it, one healthy stage at a time.

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

Start with `HANDBOOK.md` (everything needed to resume the project), then `CLAUDE.md` and `ROADMAP.md`.

## Deploying on Vercel

Import the repository and set the project's **Root Directory** to `apps/web`. Vercel detects pnpm
and the workspace automatically. Add the **production** branch values as environment variables in
Vercel, run the migrations against production once, and add the domain to Neon Auth's trusted domains.
