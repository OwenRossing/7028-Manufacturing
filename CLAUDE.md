# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

FRC Parts Tracker — a full-stack manufacturing parts tracking app for FIRST Robotics Competition teams. Built with Next.js 15 (App Router), React 19, TypeScript, Prisma + PostgreSQL, and Tailwind CSS.

## Development Commands

```bash
npm run dev          # Start Next.js dev server
npm run dev:db       # Start PostgreSQL via Docker Compose only
npm run dev:all      # Full local setup: DB + schema push + seed + dev server
npm run build        # Production build (minimum pre-PR validation)
npm run lint         # ESLint
npm run typecheck    # next typegen + tsc --noEmit
npm run db:push      # Sync Prisma schema to local DB
npm run prisma:seed  # Seed demo data
npm run db:reset     # Reset DB and reseed
```

No automated test framework is configured. Pre-PR validation: `npm run build` + manual testing of login, parts search/filter, add-part wizard, status/photo updates, and BOM import.

On WSL without Docker CLI integration, use `docker.exe compose ...`.

## Architecture

### Key Modules

- **`app/`** — Next.js App Router. Root `page.tsx` renders `<PartsExplorer />`. API routes live in `app/api/**/route.ts`.
- **`components/`** — Feature components are large client components (`"use client"`). Shared primitives are under `components/ui/`.
- **`lib/`** — Domain logic: `auth.ts` (session management), `db.ts` (Prisma singleton), `permissions.ts` (RBAC), `storage.ts` (pluggable local/S3), `status.ts` (part workflow), `workspace-config.ts` (team/robot/subsystem hierarchy), `bom/` (CSV + Onshape importers), `onshape/client.ts` (CAD API with HMAC signing).
- **`prisma/`** — `schema.prisma` defines core entities; `seed.ts` generates demo data.
- **`types/`** — Shared TypeScript types.
- **`middleware.ts`** — Authentication guard; redirects unauthenticated users to `/login`.

### Data Flow

The app is mostly **client-side-heavy**: large Client Components use **TanStack React Query** for server state. Mutations hit Next.js API routes which call Prisma directly. The root layout is a Server Component that pre-loads project metrics.

### Part Status Workflow

`DESIGNED → CUT → MACHINED → ASSEMBLED → VERIFIED → DONE` — managed by `lib/status.ts`. The main dashboard (`components/parts-explorer.tsx`, ~1,800 LOC) renders a Kanban-style stage board.

### Storage

`lib/storage.ts` exposes a `StorageProvider` interface with two implementations: `LocalStorageProvider` (files in `public/uploads/`) and `S3StorageProvider`. Switch via `STORAGE_DRIVER=local|s3` env var.

### BOM Import

Multi-stage workflow (PREVIEW → COMMITTED). Pluggable importers in `lib/bom/`: CSV (`csv-provider.ts`) and Onshape (`onshape-provider.ts`). Row-level action tracking: CREATE, UPDATE, NO_CHANGE, ERROR.

### Permissions

`lib/permissions.ts` — `isAdminUser()` (email whitelist), `canManagePart()` (owner or admin), `editorContext()`.

## Coding Conventions

- 2-space indentation; imports logically grouped
- Components: PascalCase filenames; utilities/modules: kebab-case
- API handlers: feature folder + `route.ts`
- Tailwind-first styling; avoid inline styles
- Path alias: `@/*` maps to project root

## Environment Setup

Copy `.env.example` to `.env`. Key variables:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Use `localhost` for local npm dev; `db` for container-to-container |
| `APP_MODE` | Set to `demo` to enable demo login; omit or set `production` otherwise |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID — leave empty to disable Google sign-in |
| `ADMIN_EMAILS` | Comma-separated list for admin access |
| `STORAGE_DRIVER` | `local` or `s3` |
| `NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL` | Public base URL for S3/object storage media (required when `STORAGE_DRIVER=s3`) |
| `ONSHAPE_ACCESS_KEY/SECRET_KEY` | Required for Onshape BOM import |
