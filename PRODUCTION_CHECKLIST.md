# Production Readiness Checklist

Use this checklist as the release gate for this repo.

Release target:
- Environment:
- Release owner:
- Target date:

Current execution status (2026-02-25):
- `npm ci`: PASS
- `npm run lint`: PASS (warnings only in `prisma/update-part-number-format.ts`)
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm audit --omit=dev`: PASS (0 prod vulnerabilities)
- `npm audit`: PASS (0 vulnerabilities)
- Secret scan (`git grep`): `.env` removed from git tracking; no committed live secret values found
- `npx prisma migrate status`: PASS (1 migration found, schema up to date)
- `npm run prisma:deploy`: PASS (no pending migrations)

## 1) Freeze and release prep

- [ ] Create release branch from main: `git checkout -b release/<YYYY-MM-DD-or-version>`
- [ ] Confirm no unrelated work is included: `git status`
- [ ] Tag scope/version in notes (what is shipping, what is not)

## 2) Environment and secrets

- [x] Ensure production env vars are defined (from `.env.example`, without local/test values)
- [ ] Confirm `DATABASE_URL` points to production Postgres (not localhost/container alias) (deferred)
- [ ] Confirm auth/session env vars are set for production domain + HTTPS (deferred)
- [x] Verify no secrets are committed: `git grep -n "SECRET\\|TOKEN\\|PASSWORD\\|DATABASE_URL"`

## 3) Install and build validation

- [x] Install exact dependencies: `npm ci`
- [x] Lint: `npm run lint`
- [x] Typecheck: `npm run typecheck`
- [x] Production build: `npm run build`

## 4) Database migration safety

- [x] Review pending Prisma migrations
- [x] Run production-safe migration command in deploy process: `npm run prisma:deploy`
- [x] Do **not** use `npm run db:push` in production
- [ ] Confirm backup exists before migration (DB snapshot/backup ID recorded)

## 5) Data and file storage

- [x] Confirm production strategy for uploads under `public/uploads` (persistent disk or object storage) (chosen: object storage)
- [ ] Verify image upload/read paths survive restarts and scale-out
- [ ] Validate BOM import behavior on production-like data

## 6) Security and runtime hardening

- [x] Dependency vulnerability check: `npm audit --omit=dev`
- [ ] Validate API input checks for import/mutation routes
- [ ] Confirm secure headers/HTTPS/cookie settings in deployment config
- [ ] Confirm least-privilege DB credentials in production

## 7) Staging verification (must-pass)

- [ ] Deploy to staging with production-equivalent env vars
- [ ] Run smoke tests:
  - [ ] Login
  - [ ] Parts search/filter
  - [ ] Add part wizard
  - [ ] Status/photo updates
  - [ ] BOM import preview/commit
- [ ] Capture screenshots or short recordings for release notes

## 8) Deploy execution

- [ ] Announce deploy window and rollback owner
- [ ] Run DB migrations: `npm run prisma:deploy`
- [ ] Deploy app (`npm run build` + `npm run start` on target platform, or platform equivalent)
- [ ] Verify health endpoint/app availability
- [ ] Run production smoke test on live URL

## 9) Post-deploy checks (24-48h)

- [ ] Monitor app/server logs for auth, API, and DB errors
- [ ] Monitor performance and error rate
- [ ] Confirm uploads/imports continue to work
- [ ] Document incidents/fixes and create follow-up tasks

## 10) Release closeout

- [ ] Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"` then `git push --tags`
- [ ] Publish release notes (migrations, env changes, user-visible changes)
- [ ] Record final checklist sign-off in PR/issue tracker

## Quick command block

```bash
npm ci
npm run lint
npm run typecheck
npm run build
npm run prisma:deploy
npm audit --omit=dev
```
