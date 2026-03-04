# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (`app/api/**/route.ts`).
- `components/`: Reusable UI and feature components (`components/ui/*`, `parts-explorer`, `add-part-wizard`).
- `lib/`: Shared domain and utility logic (`db.ts`, auth helpers, BOM/image providers).
- `prisma/`: Database schema and seed scripts (`schema.prisma`, `seed.ts`).
- `public/`: Static assets and uploaded images (`public/uploads`).
- `types/`: Shared TypeScript types.

## Build, Test, and Development Commands
- `npm run dev`: Start the Next.js dev server.
- `npm run dev:db`: Start only PostgreSQL via Docker Compose.
- `npm run dev:all`: Start DB, push schema, seed demo data, then run app.
- `npm run build`: Production build + type check (minimum pre-PR validation).
- `npm run start`: Run production server from build output.
- `npm run db:push`: Sync Prisma schema to local DB.
- `npm run prisma:seed`: Seed local demo data.
- `npm run db:reset`: Reset DB and reseed.

## Coding Style & Naming Conventions
- Stack: TypeScript (`.ts/.tsx`), React 19, Next.js App Router.
- Indentation: 2 spaces; keep imports logically grouped.
- Components use PascalCase (e.g., `PartDetailClient`).
- Utility/module filenames use kebab-case (e.g., `part-number.ts`).
- API handlers live in feature folders as `route.ts`.
- Styling is Tailwind-first with shared primitives under `components/ui`.

## Testing Guidelines
- No dedicated automated test framework is configured yet.
- Before opening a PR, run `npm run build` and manually verify: login, parts search/filter, add part wizard, status/photo updates, and BOM import preview/commit.
- If adding tests, use `*.test.ts` or `*.test.tsx`, colocated with features or under `tests/`.

## Commit & Pull Request Guidelines
- Use short, imperative, scoped commits (example: `Polish part detail actions`).
- Keep commits focused; avoid mixing feature, refactor, and infra changes.
- PRs should include: clear user-visible summary, setup/migration notes (especially Prisma/env), screenshots or GIFs for UI changes, and linked issue/project item when relevant.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; never commit secrets.
- For local npm usage, set `DATABASE_URL` to `localhost`; `db` host is for container-to-container networking.
- On WSL without Docker CLI integration, use `docker.exe compose ...`.
