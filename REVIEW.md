# Repo Review + Development Path: Onshape API Import Subsystem

## 1) Current-State Review (what exists today)

### Import architecture baseline
- BOM import already uses a provider seam (`BomImportProvider`) but it is synchronous and string-parse-only (`parse(content: string)`), which is good for CSV but too narrow for API-backed sources. The Onshape path will need an async provider contract for network fetch + normalization. 
- CSV import route (`POST /api/imports/bom`) currently:
  - requires admin auth,
  - consumes multipart `file`,
  - applies Team/Year/Robot prefix filtering,
  - computes `CREATE`/`UPDATE`/`NO_CHANGE`/`ERROR` preview rows,
  - stores an `ImportBatch` + `ImportRow` preview in Prisma.
- Commit route is already idempotency-aware via `x-idempotency-key`, then applies row actions and writes `PartEventType.IMPORTED` events.

### UI baseline
- Import UI is currently CSV-only and does not expose Team/Year/Robot filters as user-editable controls; it only sends `projectId` + `file`.
- UI summary already renders a `filteredOut` count, but because filters are not exposed, this is less transparent for admins.

### Data model baseline
- Parts are uniquely keyed by `(projectId, partNumber)` and currently do **not** persist Onshape document/workspace/element identifiers or a stable Onshape row key for re-sync.
- Import rows do have `externalKey`, which can be leveraged as a bridge during migration to full Onshape identifiers.

### Thumbnail/image baseline
- `lib/part-thumbnails.ts` uses runtime raw SQL (`$executeRawUnsafe`, `$queryRawUnsafe`) to create/query `app_part_thumbnails`. This bypasses Prisma schema/migrations and is the main blocker for reliable image sync semantics.
- A thumbnail API exists and can assign an existing `PartPhoto.storageKey` as the selected thumbnail. This means an Onshape preview image ingest path can integrate with existing storage + thumbnail selection semantics once thumbnail persistence is moved to Prisma.

### Infra/config baseline
- CI is already present (`.github/workflows/ci.yml`) and runs install, Prisma generate, lint, typecheck, and build.
- Env variables are documented in `.env.example` and README, but there is no central runtime env schema that fails fast at boot.
- Storage is function-based (`saveUpload`, `deleteUpload`) and local-filesystem only (`public/uploads`); no interface abstraction for S3/R2 yet.

## 2) Gap analysis against requested milestones

## Milestone v0.1 MVP polish

1. **Replace thumbnails raw SQL with Prisma model + migration**
   - Status: **Not done**.
   - Gap: No `PartThumbnail` Prisma model; raw SQL table lifecycle in app code.

2. **Make BOM import filters real inputs in UI**
   - Status: **Partially done** (server supports params; client does not send).
   - Gap: Missing Team/Year/Robot form fields + FormData wiring in UI.

3. **Harden CSV BOM parser and validation**
   - Status: **Partially done**.
   - Gap: parser is minimal; validation errors do not include rich row/column diagnostics.

4. **Add basic CI (lint + typecheck + build)**
   - Status: **Done**.
   - Note: Existing CI includes exactly this and also `prisma:generate`.

5. **Env validation at boot**
   - Status: **Not done**.
   - Gap: no shared Zod env guard loaded at startup.

6. **Storage provider abstraction (prep for S3/R2)**
   - Status: **Not done**.
   - Gap: no `StorageProvider` interface; routes import concrete local helpers.

## Milestone v0.2 Onshape API import MVP

1. **Onshape API client wrapper (HMAC signing + retries)**
   - Status: **Not done**.

2. **Onshape BOM provider (API-backed)**
   - Status: **Not done**.

3. **Preview import route for Onshape source**
   - Status: **Not done**.

4. **UI flow: Import from Onshape (selectors)**
   - Status: **Not done**.

5. **Persist Onshape identifiers on parts for re-sync**
   - Status: **Not done**.

6. **Re-sync from Onshape action (idempotent)**
   - Status: **Not done**.

## 3) Recommended implementation path (execution order)

### Phase 0: Foundation hardening (before Onshape API)
1. **Prisma thumbnail migration first**
   - Add `PartThumbnail` model (`partId` unique FK -> `Part`, `storageKey`, timestamps).
   - Write migration to copy/rename existing `app_part_thumbnails` table data if present.
   - Replace `lib/part-thumbnails.ts` raw SQL with `prisma.partThumbnail.*`.
   - Why first: removes runtime schema mutation and makes image linkage deterministic before auto-preview ingestion.

2. **Env schema fail-fast**
   - Add `lib/env.ts` with Zod schema and typed export.
   - Validate required vars: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `MAX_UPLOAD_MB`; optional admin/session keys with defaults.
   - Import once in server entrypoints used by API routes.

3. **Storage abstraction seam**
   - Add `StorageProvider` interface:
     - `save(params) -> { storageKey, publicUrl }`
     - `delete(storageKey)`
     - `getPublicUrl(storageKey)`
   - Implement `LocalStorageProvider` with current behavior.
   - Replace direct `saveUpload/deleteUpload` consumers with provider dependency.

### Phase 1: Improve current CSV import UX/reliability
4. **Expose Team/Year/Robot filters in `ImportBomClient`**
   - Add form controls + defaults.
   - Append to FormData and persist current selection in state.
   - Keep preview summary filtered-out counts visible.

5. **CSV parser + validator hardening**
   - Add structured validation result (`validRows`, `rowErrors[]`).
   - Record row + column names in `errorMessage` (e.g., `Row 12: Quantity column "Qty" has non-integer value "2x"`).
   - Make quantity parse robust (`1`, `1.0`, trim whitespace); reject negatives and NaN.

### Phase 2: Add Onshape API import capability
6. **Create `lib/onshape/client.ts`**
   - Implement request signing for Onshape HMAC auth.
   - Centralize retries/backoff for transient 429/5xx errors.
   - Add request id/log context to aid troubleshooting.

7. **Introduce async BOM provider model**
   - Evolve provider contract to support:
     - CSV parse provider (`parse(content)`),
     - Onshape provider (`fetchAndNormalize({ documentId, workspaceId, elementId, ... })`).
   - Keep existing CSV route stable while introducing source-dispatch.

8. **Add Onshape preview route path**
   - Option A (recommended): extend `/api/imports/bom` with `sourceType` union (`CSV_ONSHAPE_EXPORT | ONSHAPE_API`).
   - Option B: parallel route `/api/imports/bom/onshape`.
   - Persist `ImportBatch.sourceType = ONSHAPE_API` and include request metadata in `summaryJson`/row `rawJson`.

9. **UI mode switch: CSV vs Onshape API**
   - Add segmented control/radio in import page.
   - For Onshape mode, collect doc/workspace/element (+ optional microversion/config when needed).
   - Use same preview table/commit UX so operational behavior remains familiar.

### Phase 3: Re-sync + preview images automation
10. **Persist external identifiers on `Part`**
    - Add nullable indexed fields, for example:
      - `onshapeDocumentId`,
      - `onshapeWorkspaceId` (or version/microversion model),
      - `onshapeElementId`,
      - `onshapePartId` (stable per part).
    - During import, upsert these fields from normalized rows.

11. **Idempotent re-sync action**
    - Add API route/action to fetch latest Onshape BOM and recompute row actions.
    - Reuse commit pipeline with idempotency token scope (`onshape-resync:<projectId>:<doc...>`).
    - Ensure reruns produce `NO_CHANGE` when data is unchanged.

12. **Automatic preview image ingestion**
    - Extend Onshape provider normalization to include preview image URLs or image endpoint references.
    - Download each image via Onshape client -> store through `StorageProvider`.
    - Create/associate `PartPhoto` + set `PartThumbnail` deterministically (e.g., first Onshape image unless user-selected override exists).
    - Add guardrails:
      - max image size,
      - mime-type allowlist,
      - duplicate detection via hash or same external image key.

## 4) Proposed issue breakdown (ready to add to tracker)

Below are the recommended issue titles with dependencies and rough sizing.

1. **Migrate part thumbnails to Prisma model and remove raw SQL table management** (M, blocks image automation)
2. **Add env schema validation with Zod and fail-fast startup errors** (S)
3. **Introduce StorageProvider abstraction with LocalStorageProvider implementation** (M)
4. **Expose Team/Year/Robot BOM filters in Import UI and include in FormData** (S)
5. **Refactor CSV BOM parsing into parse+validate with row/column-level errors** (M)
6. **Build Onshape API client wrapper with HMAC signing, retries, and typed responses** (L)
7. **Add async BOM provider contract and implement Onshape BOM provider** (L)
8. **Support `sourceType=ONSHAPE_API` in BOM preview route and persist preview batch** (M)
9. **Add Import UI mode switch for CSV vs Onshape (doc/workspace/element inputs)** (M)
10. **Persist Onshape external identifiers on Part model and wire during import** (M)
11. **Add idempotent Re-sync from Onshape action + event logging** (M)
12. **Implement automatic preview image fetch/store/thumbnail assignment for Onshape parts** (L)

## 5) Definition of done for “Import subsystem with IDs + automatic previews”

- Admin can select Onshape source and identify doc/workspace/element from UI.
- Preview batch is generated with `CREATE/UPDATE/NO_CHANGE/ERROR` parity to CSV flow.
- Commit and re-sync are idempotent and safe to rerun.
- Parts persist stable Onshape identifiers for unambiguous future sync.
- Preview images are automatically downloaded and surfaced as thumbnails without manual SQL/table logic.
- Operational safeguards exist for env validation, retry behavior, and storage limits.

## 6) About Linear connectivity

I cannot confirm a direct Linear integration from this environment unless a Linear tool is explicitly exposed. If needed, use the issue list in section 4 as copy/paste-ready tickets.
