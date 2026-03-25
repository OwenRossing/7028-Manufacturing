# 7028 Manufacturing — FRC Parts Tracker

A full-stack manufacturing parts tracking app for FIRST Robotics Competition teams. Built to manage the lifecycle of robot parts from design through final assembly, with a Kanban-style board, BOM imports, photo uploads, and role-based access control.

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Styling:** Tailwind CSS
- **Storage:** Local filesystem or AWS S3
- **Auth:** Google OAuth or demo mode

## Part Status Workflow

Parts move through these stages:

```
DESIGNED → CUT → MACHINED → ASSEMBLED → VERIFIED → DONE
```

## Getting Started

### Option 1 — Docker (recommended)

```bash
cp .env.example .env
docker compose up
```

App will be available at [http://localhost:3000](http://localhost:3000).

### Option 2 — Local dev

Requires Node.js and a running PostgreSQL instance (Docker is the easiest way to get one).

```bash
cp .env.example .env
# Edit DATABASE_URL in .env to point to your local Postgres instance

npm install
npm run dev:all   # starts DB, pushes schema, seeds demo data, starts dev server
```

Or step by step:

```bash
npm run dev:db       # Start PostgreSQL via Docker Compose
npm run db:push      # Sync Prisma schema
npm run prisma:seed  # Seed demo data
npm run dev          # Start Next.js dev server
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (`localhost` for local npm dev; `db` for Docker) |
| `APP_MODE` | Set to `demo` to enable one-click demo login |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID — omit to disable Google sign-in |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` | Public base URL for media (required when using S3) |
| `ONSHAPE_ACCESS_KEY` / `ONSHAPE_SECRET_KEY` | Required for Onshape BOM import |

## Features

- **Kanban board** — drag-and-drop parts across workflow stages
- **BOM import** — import parts from CSV or directly from Onshape assemblies
- **Photo uploads** — attach photos to parts; stored locally or in S3
- **RBAC** — admin vs. viewer roles; part ownership controls
- **Mobile-friendly** — responsive layout with swipe navigation on mobile

## Scripts

```bash
npm run build          # Production build
npm run lint           # ESLint
npm run typecheck      # Type check
npm run db:reset       # Reset DB and reseed demo data
npm run prisma:seed    # Seed demo data only
```
