# Context Dump (Agent Handoff)

## TL;DR
- Project: FRC manufactured parts tracker demo.
- Stack: Next.js App Router + Prisma + Postgres + Tailwind + TanStack Query.
- Primary UX direction: Amazon-like top shell, search-first explorer, fast-feeling actions.
- Current branch: `main` (pushed previously), this file is for quick agent onboarding.

## Product Intent
- Track fabricated robot parts per project and per user.
- Primary flow: search/find parts quickly, update status, assign owners, attach photo evidence.
- Status lifecycle: `DESIGNED -> CUT -> MACHINED -> ASSEMBLED -> VERIFIED -> DONE`.
- Done gate: cannot set `DONE` without at least one photo.
- Part number format is strict: `TEAM-YEAR-ROBOT-PARTCODE` (e.g. `7028-2026-R1-1001`).

## Architecture Snapshot
- UI routes in `app/`:
  - `/` explorer (`components/parts-explorer.tsx`)
  - `/parts/new` wizard (`components/add-part-wizard.tsx`)
  - `/parts/[id]` detail (`components/part-detail-client.tsx`)
  - `/import`, `/projects`, plus prototype routes.
- API routes in `app/api/**`:
  - auth (`demo-login`), parts CRUD/mutations, imports, projects, users.
- Data:
  - Prisma schema: `prisma/schema.prisma`
  - Seed: `prisma/seed.ts`
  - Utilities: `lib/*` (auth, status, part-number, idempotency, providers)

## Runbook
- Full local app+db: `docker compose up --build`
- Fast UI dev: `npm run dev:all`
  - starts DB container, pushes schema, seeds, runs Next dev
- Build check: `npm run build`

## Important Environment Notes
- For local npm commands, `DATABASE_URL` should use `localhost`, not `db`:
  - `postgresql://postgres:postgres@localhost:5432/frc_parts?schema=public`
- `db` hostname only works inside Docker network (container-to-container).

## Recent UX Decisions
- Prefer single-action workflows over multi-step controls.
- Part detail polish:
  - Primary status action: “Advance to Next”
  - Manual status selector remains as backup.
  - Photo upload uses one-button flow (“Add Photo”) then auto-upload on file pick.

## Open Edges / Next Priority
- Continue visual polish and spacing consistency.
- Simplify ownership UI complexity where possible.
- Compare project drawer prototypes and choose final direction.
- Add tests (currently no dedicated test suite; build/typecheck is primary gate).

## Agent Guidance
- Read `AGENTS.md` first for contributor conventions.
- Preserve current UX direction: centralized shell, search-first, low-friction interactions.
- Avoid reintroducing old multi-step form patterns where single-action controls work.
