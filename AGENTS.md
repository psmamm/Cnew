# AGENTS.md

This file is a **repo-specific operating manual** for AI coding agents (and humans) working in this codebase.

## Repo overview

Tradecircle is a Vite + React + TypeScript web app with a Cloudflare Workers (Hono) API and a D1 (SQLite) database.

- **Frontend**: `src/react-app/` (React 19, React Router, Tailwind)
- **Backend (API)**: `src/worker/` (Cloudflare Worker, Hono routers mounted under `/api/*`)
- **Shared types**: `src/shared/` (Zod schemas/types intended to be shared client/server)
- **DB migrations**: `migrations/` (SQL, used for the D1 schema)
- **Static assets**: `public/`
- **Legacy/alternate tree**: `alles/` (appears to contain a parallel copy of the app; avoid changing unless a task explicitly targets it)

## Common commands

All commands are run from the repo root.

- **Install**: `npm install`
- **Dev server**: `npm run dev`
- **Typecheck + build**: `npm run build`
- **Lint**: `npm run lint`
- **Full check** (typecheck + build + deploy dry-run): `npm run check`
- **Regenerate Cloudflare Worker types**: `npm run cf-typegen` (writes `worker-configuration.d.ts`)

## Environment & secrets

### Frontend (Vite)

The client reads Vite env vars via `import.meta.env.*`.

- **Required for Supabase** (throws at startup if missing):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Optional**:
  - `VITE_BINANCE_API_BASE_URL` (defaults to `https://api.binance.com`)

Notes:
- Firebase client config currently lives in `src/react-app/lib/firebase.ts`. **Firebase web config is not a secret**, but do not add sensitive keys/tokens to the client bundle.

### Worker (Wrangler bindings + runtime env vars)

Local Worker secrets are typically provided via `.dev.vars` (ignored by git). In deployed environments use Wrangler secrets/vars.

Bindings used by the worker include:
- **D1**: `DB`
- **R2**: `R2_BUCKET`
- **Workers AI**: `AI`

Runtime env vars used in the worker (see `src/worker/index.ts` and routers):
- `MOCHA_USERS_SERVICE_API_URL`
- `MOCHA_USERS_SERVICE_API_KEY`
- Block explorer API keys (e.g. `ETHERSCAN_API_KEY`, `BSCSCAN_API_KEY`, `ARBISCAN_API_KEY`, etc.)
- Other third-party keys referenced by individual routes

Safety rules:
- **Never commit** `.env*` files, `.dev.vars`, tokens, or API keys.
- Avoid logging sensitive request bodies/headers. If debugging is required, log **redacted** values.

## Codebase conventions (follow these)

- **TypeScript is strict** (especially under `src/react-app/`): avoid `any`, prefer narrowing and Zod validation.
- **Imports**: use the `@/` alias for `src/*` (configured in `tsconfig.*` + `vite.config.ts`).
- **API validation**: for new API endpoints, validate inputs with Zod (`@hono/zod-validator`) and return structured errors.
- **Shared types**: if a type is used on both sides, prefer defining it in `src/shared/` as a Zod schema + inferred TypeScript type.
- **Routing**:
  - Frontend routes live in `src/react-app/App.tsx`.
  - Worker routes live in `src/worker/routes/*` and are mounted in `src/worker/index.ts`.

## Database migrations (D1)

Schema lives under `migrations/`.

- Prefer **adding a new migration** instead of editing existing ones.
- Follow the existing numbering pattern (`migrations/1.sql`, `migrations/2.sql`, …) and keep changes forward-only.
- If this repo expects down migrations, there are numbered folders (e.g. `migrations/1/down.sql`). Mirror that pattern if you add a reversible change.

## Making changes safely (agent workflow)

When implementing a change:
- Keep edits scoped to the relevant tree (`src/react-app` vs `src/worker`).
- Update types/schemas first (shared Zod schemas if applicable), then update call sites.
- Run at least one of:
  - `npm run lint` (for small UI-only changes), or
  - `npm run check` (for anything that touches the worker, build output, or deployment behavior).

If you see TypeScript errors that predate your change (there is a `tsc_output.txt` snapshot in repo), do not attempt a large “drive-by” refactor unless the task requires it—keep the fix targeted.

