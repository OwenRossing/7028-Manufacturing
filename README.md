# FRC Parts Tracker Demo

Vertical-slice demo for manufactured part tracking in FRC robotics.

## Stack

- Next.js (App Router + API routes)
- PostgreSQL + Prisma
- Docker Compose (`web` + `db`)

## Features in this demo

- Google sign in only (`@stmarobotics.org` accounts)
- Table-first parts explorer with search and status filters
- Part detail with:
  - status transitions (`DESIGNED -> CUT -> MACHINED -> ASSEMBLED -> VERIFIED -> DONE`)
  - primary owner + collaborators
  - activity timeline
  - photo upload
- Done-gate: status cannot move to `DONE` without at least one photo
- BOM CSV import:
  - preview (`CREATE`, `UPDATE`, `NO_CHANGE`, `ERROR`)
  - commit with idempotency support
  - filter by team/year/robot prefix (for example `7028-2026-R1`)

## Quick Start (Docker Desktop)

1. Copy `.env.example` to `.env` if you want local overrides.
2. Run:

```bash
docker compose up --build
```

3. Open `http://localhost:3000`.
4. Sign in with a Google account under `@stmarobotics.org`.

## Faster UI Development on Windows

For faster hot reload during UI work, run:

```bash
npm run dev:all
```

This runs:

- `docker compose up -d db`
- `npm run db:push`
- `npm run prisma:seed`
- `npm run dev`

Manual equivalent:

1. Start only DB with Docker:

```bash
docker compose up db
```

2. In another terminal, run app locally:

```bash
npm install
npm run db:push
npm run prisma:seed
npm run dev
```

The container startup command automatically runs:

- `npm install`
- `prisma db push`
- `prisma seed`
- `next dev`

## API Highlights

- `POST /api/auth/google`
- `POST /api/auth/logout`
- `GET|POST /api/parts`
- `GET|PATCH /api/parts/:id`
- `POST /api/parts/:id/status`
- `POST /api/parts/:id/owners`
- `POST /api/parts/:id/photos`
- `GET /api/parts/:id/events`
- `POST /api/imports/bom`
- `GET /api/imports/:batchId`
- `POST /api/imports/:batchId/commit`

## Future-ready seams already present

- BOM provider abstraction allows Onshape API provider later.
- Image processing provider can be introduced for background removal later.

## Production Configuration

Set these in your deployment environment:

- `DATABASE_URL`
- `APP_MODE=production`
- `NEXT_PUBLIC_APP_MODE=production`
- `GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `DEMO_SESSION_COOKIE` (optional custom cookie name)
- `SESSION_TTL_SECONDS` (optional, defaults to 14 days)
- `MAX_UPLOAD_MB`
- `ADMIN_EMAILS` (comma-separated admin account emails)

Google auth notes:

- Create OAuth client credentials in Google Cloud.
- Set authorized JavaScript origins to your app URL.
- Use the same client id for `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- Authentication is restricted to `@stmarobotics.org` emails.

Admin account model:

- Users are auto-created at first Google sign-in.
- Admin rights are granted by email via `ADMIN_EMAILS` and can be managed in-app from Settings -> Admin Accounts.
- Example: `ADMIN_EMAILS="coach@team7028.org,lead@team7028.org"`.
