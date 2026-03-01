# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes.
  - UI routes: `app/page.tsx`, `app/parts/*`, `app/projects/*`, `app/import/*`, `app/login/*`
  - API routes: `app/api/**/route.ts`
- `components/`: Reusable UI and feature components (for example `components/ui/*`, `parts-explorer`, `add-part-wizard`).
- `lib/`: Shared utilities and domain logic (`db.ts`, auth helpers, status/part-number rules, BOM/image providers).
- `prisma/`: Database schema and seed scripts (`schema.prisma`, `seed.ts`).
- `public/`: Static assets and uploaded images (`public/uploads`).
- `types/`: Shared TypeScript types.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server.
- `npm run dev:db`: Start PostgreSQL container only (`docker compose up -d db`).
- `npm run dev:all`: Start DB, push schema, seed demo data, and run dev server.
- `npm run build`: Production build with type checking (minimum pre-PR validation).
- `npm run start`: Run production server from build output.
- `npm run db:push`: Sync Prisma schema to local DB.
- `npm run prisma:seed`: Seed local demo data.
- `npm run db:reset`: Reset DB and reseed.

## Coding Style & Naming Conventions
- Language stack: TypeScript (`.ts/.tsx`), React 19, Next.js App Router.
- Indentation: 2 spaces; keep imports logically grouped.
- Naming:
  - Components: PascalCase (`PartDetailClient`)
  - Utility/module files: kebab-case (`part-number.ts`, `status.ts`)
  - API handlers: `route.ts` in feature folders
- Styling: Tailwind-first, with reusable primitives in `components/ui`.

## Testing Guidelines
- No dedicated automated test framework is configured yet.
- Before opening a PR, run `npm run build` and manually verify critical flows:
  - login
  - parts search/filter
  - add part wizard
  - status/photo updates
  - BOM import preview/commit
- When adding tests, use `*.test.ts` or `*.test.tsx`, colocated with features or under `tests/`.

## Commit & Pull Request Guidelines
- Use short, imperative, scoped commit messages (example: `Polish part detail actions`).
- Keep commits focused; avoid mixing feature, refactor, and infra changes.
- PRs should include:
  - clear summary of user-visible changes
  - setup/migration notes (especially Prisma or env changes)
  - screenshots/GIFs for UI changes
  - linked issue/project item when relevant

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- For local npm commands, use a `DATABASE_URL` with `localhost`; `db` hostname is for container-to-container networking.
- On WSL without Docker CLI integration, use Docker Desktop via `docker.exe compose ...`.
