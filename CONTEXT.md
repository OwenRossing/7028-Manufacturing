# Context Dump (Agent Handoff)

## TL;DR
- Project: FRC manufactured parts tracker demo.
- Stack: Next.js App Router + Prisma + Postgres + Tailwind + TanStack Query.
- Current primary UX: search-first explorer, quick status/owner/photo actions, manual part wizard + BOM preview/commit.
- Part number UX was updated: wizard now uses 4 fields (team/year/robot/part code) and auto-builds canonical part number.

## Product Intent
- Track fabricated robot parts per project and per user.
- Main loop: find part fast, update status, set ownership, attach photo evidence.
- Status lifecycle: `DESIGNED -> CUT -> MACHINED -> ASSEMBLED -> VERIFIED -> DONE`.
- Done gate: cannot set `DONE` without at least one photo.

## Architecture Snapshot
- UI routes in `app/`:
  - `/` explorer (`components/parts-explorer.tsx`)
  - `/parts/new` wizard (`components/add-part-wizard.tsx`)
  - `/parts/[id]` detail (`components/part-detail-client.tsx`)
  - `/import`, `/projects`, plus prototype routes
- API routes in `app/api/**`:
  - demo auth, parts CRUD/mutations, import preview/commit, projects, users
- Data:
  - Prisma schema: `prisma/schema.prisma`
  - Seed: `prisma/seed.ts`
  - Utilities in `lib/*` (auth, status, part-number, idempotency, providers)

## Recent Changes
- Part number entry in add-part wizard changed from one strict input to 4 segmented inputs.
- Team and year are prefilled by default.
- Wizard constructs and validates canonical format before submit.
- Helper utilities added in `lib/part-number.ts`:
  - `defaultTeamNumber()`
  - `defaultSeasonYear()`
  - `buildPartNumber(...)`

## Environment Notes (WSL)
- For local npm commands, use localhost DB URL:
  - `postgresql://postgres:postgres@localhost:5432/frc_parts?schema=public`
- `db` host is only for container-to-container networking.
- Docker CLI may not be integrated directly in WSL; using Docker Desktop via `docker.exe compose ...` works.
- GitHub SSH is configured in WSL for this machine.

## Operational Runbook
- Start DB: `docker.exe compose up -d db` (or `docker compose up -d db` if integrated)
- Push schema: `npm run db:push`
- Seed: `npm run prisma:seed`
- Run app: `npm run dev`
- Build gate: `npm run build`

## Known Edges
- Seed part number (`7028-DRIVE-PLATE-A`) does not match currently enforced part number regex.
- No dedicated automated test suite yet; build/typecheck + manual critical-path checks are current gate.

