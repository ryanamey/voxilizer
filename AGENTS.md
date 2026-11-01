# Voxilizer — instructions for AI agents (Codex, Claude, others)

Read these before doing anything, in order:

1. `HANDBOOK.md`: the product, every decision, current status (§8) and next steps (§9).
2. `CLAUDE.md`: technical summary and conventions (it applies to every agent, not only Claude).
3. `ROADMAP.md`: what's done and what's next.
4. `docs/cvt/`: the singing method (Complete Vocal Technique) that Grit Lab's rules follow.
5. `apps/web/AGENTS.md`: Next.js 16 has breaking changes; read the bundled docs before using an
   unfamiliar API.

## Who does what

- **Founder (Ali, GitHub `ryanamey`)**: product owner, architect, and the ears. Approves anything
  that costs money, touches production data, or can't be undone.
- **Claude**: all coding: features, the engine, tests and docs. It commits on the founder's PC
  (or delivers git bundles) but can't push to GitHub.
- **Codex**: connects the project to **GitHub, Vercel and Neon**, and nothing else:
  - push Claude's commits to GitHub, open and merge pull requests, keep CI green by reporting
    failures (not by fixing code);
  - Vercel: deployments, environment variables, domains;
  - Neon: run the Drizzle migrations (`pnpm db:migrate`), development branch first.

  **Codex does not write or change code**, including "small fixes", formatting, dependency bumps or
  docs. If CI fails or something needs a code change, Codex reports it to the founder, who passes
  it to Claude.

Claude keeps `HANDBOOK.md` §8 (status), `ROADMAP.md` and the decisions log (§4) up to date. Codex
reports what it did (pushes, deployments, migrations) to the founder, who tells Claude.

## Repository

- GitHub: `ryanamey/voxilizer`, default branch `main`. CI (`.github/workflows/ci.yml`) runs format,
  lint, typecheck, unit tests, build and Playwright on every push and pull request.
- pnpm 10 workspace, Node 22 (`.nvmrc`): `apps/web` (Next.js app) and `packages/engine` (pure
  TypeScript sound engine; must stay free of browser APIs).
- Before every commit (Claude) and before every merge to `main` (Codex checks CI), all of these
  must pass:
  ```bash
  pnpm install
  pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
  pnpm --filter web test:e2e
  ```
- Commit messages: a short imperative subject, then a body explaining why. Say so explicitly when a
  change alters how songs sound (`packages/engine/src/constants.ts`, `render.ts`).

## Never

- Commit secrets. `apps/web/.env.local` is git-ignored; `apps/web/.env.example` lists the variables.
- Commit `sources/` (copyrighted CVT material and personal recordings) or `*.bundle` files.
- Use production database values anywhere except Vercel's environment variables.
- Change the database schema except through Drizzle migrations (`apps/web/drizzle/`), applied to the
  Neon **development** branch first, and to production only with the founder's approval.
- Force-push `main`, rewrite published history, or delete branches you didn't create.
- Deploy to production, add paid services, or change domains/DNS without the founder's approval.

## Vercel

- Project root directory: `apps/web`. Vercel detects pnpm and the workspace.
- Environment variables (production values from the Neon `production` branch): `DATABASE_URL`,
  `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (a new random value for production),
  `NEXT_PUBLIC_APP_URL` (the deployed URL), and `NEXT_PUBLIC_SENTRY_DSN` once Sentry exists. Neon Auth must list the deployed domain as a trusted domain.
- Run `pnpm db:migrate` against production once, with approval, before the first production deploy.
- Pull requests get preview deployments; `main` deploys to production.
- The app sets COOP/COEP headers (`apps/web/next.config.ts`); keep them, the audio engine needs
  cross-origin isolation.
