# FRC Parts Tracker Demo

Vertical-slice demo for manufactured part tracking in FRC robotics.

## Stack

- Next.js (App Router + API routes)
- PostgreSQL + Prisma
- Docker Compose (`web` + `db`)

## Features in this demo

- Demo sign in (`alex@team7028.org`, `riley@team7028.org`)
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

## Quick Start (Docker Desktop)

1. Copy `.env.example` to `.env` if you want local overrides.
2. Run:

```bash
docker compose up --build
```

3. Open `http://localhost:3000`.
4. Sign in with a seeded email:
   - `alex@team7028.org`
   - `riley@team7028.org`

The container startup command automatically runs:

- `npm install`
- `prisma db push`
- `prisma seed`
- `next dev`

## API Highlights

- `POST /api/auth/demo-login`
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

- Auth boundary supports replacing demo login with Google OAuth.
- BOM provider abstraction allows Onshape API provider later.
- Image processing provider can be introduced for background removal later.
