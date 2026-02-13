# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes.
  - UI routes: `app/page.tsx`, `app/parts/*`, `app/projects/*`, `app/import/*`, `app/login/*`
  - API routes: `app/api/**/route.ts`
- `components/`: Reusable UI and feature components (for example `components/ui/*`, `parts-explorer`, `add-part-wizard`).
- `lib/`: Shared utilities and domain logic (`db.ts`, auth helpers, status/part-number rules, BOM/image providers).
- `prisma/`: Database schema and seed (`schema.prisma`, `seed.ts`).
- `public/`: Static assets and uploaded image directory (`public/uploads`).
- `types/`: Shared TypeScript types.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js dev server.
- `npm run dev:db`: Start PostgreSQL container only (`docker compose up -d db`).
- `npm run dev:all`: Start DB, push schema, seed data, and run dev server.
- `npm run build`: Production build (includes type checking).
- `npm run start`: Run production server from build output.
- `npm run db:push`: Sync Prisma schema to DB.
- `npm run prisma:seed`: Seed demo data.
- `npm run db:reset`: Reset DB and reseed.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts/.tsx`), React 19, Next.js App Router.
- Indentation: 2 spaces; keep imports grouped and sorted logically.
- Naming:
  - Components: PascalCase (`PartDetailClient`).
  - Helpers/hooks/util files: kebab-case or lower-case (`part-number.ts`, `status.ts`).
  - API route files: `route.ts` under feature folders.
- Styling: Tailwind-first with small reusable UI primitives in `components/ui`.

## Testing Guidelines
- No dedicated test framework is configured yet.
- Minimum validation before PR:
  - `npm run build` passes
  - Critical flows verified manually: login, parts search/filter, add part wizard, status/photo updates, BOM import preview/commit.
- When adding tests later, place them near features or under `tests/` with `*.test.ts(x)` naming.

## Commit & Pull Request Guidelines
- Commit messages should be short, imperative, and scoped (example: `Polish part detail actions`).
- Keep commits focused; avoid mixing refactor + feature + infra in one commit.
- PRs should include:
  - clear summary of user-visible changes,
  - setup/migration notes (especially Prisma or env changes),
  - screenshots/GIFs for UI updates,
  - linked issue/project item when applicable.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and keep secrets out of git.
- For local npm commands, use `DATABASE_URL` with `localhost`; `db` hostname is for container-to-container networking.
