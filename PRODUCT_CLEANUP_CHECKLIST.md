# Product Cleanup Checklist (Pre-Production UX/Behavior)

This is separate from infra/deploy readiness. Use this to close behavior, clarity, and UX issues before launch.

## 1) Role + Permission Contract (P0)

Goal: define and document exactly what non-admins can do.

- [ ] Publish a one-page policy in docs (`docs/permissions.md`) and mirror key rules in UI copy.
- [ ] Add acceptance tests for permission-critical flows (manual checklist minimum).
- [ ] Resolve OWEN-26 policy decision: can parts move to Machined with no assigned owner?

Current behavior from code (definitive as of now):

- Signed-out user:
  - Cannot claim roles.
  - Cannot edit part settings, status, owners, media.
- Signed-in non-admin, not assigned to part:
  - Can claim machinist if unassigned (`POST /api/parts/[id]/claim-machinist`).
  - Can claim finisher if no collaborator exists (`POST /api/parts/[id]/claim-finisher`).
  - Cannot edit status/owners/media/details until assigned.
- Signed-in non-admin, assigned (primary/collaborator):
  - Can edit status/details/owners/media for that part.
  - Can set thumbnail and upload/delete media for that part.
- Admin:
  - Can manage all parts and admin-only endpoints (imports/onshape config/user admin/project admin).

Evidence:
- `lib/permissions.ts`
- `app/api/parts/[id]/claim-machinist/route.ts`
- `app/api/parts/[id]/claim-finisher/route.ts`
- `app/api/parts/[id]/status/route.ts`
- `components/part-detail-client.tsx`
- `components/parts-explorer.tsx`

## 2) Mobile Navigation + Interaction Model (P0)

Issues: OWEN-17, OWEN-19, OWEN-21.

- [ ] Finalize one-way mobile navigation model:
  - Part detail opens as right-side slide-in.
  - Swipe-close returns to board while preserving selected part.
- [ ] Hide/search/kanban panel behavior matches selected mobile pattern (Discord-like drawer).
- [ ] Bottom bar replaces top nav on mobile (single primary navigation system).
- [ ] Add QA checklist for gesture conflict (scroll vs swipe) and URL/back-button behavior.

Acceptance criteria:
- [ ] Closing detail keeps previous selected part highlighted.
- [ ] Browser back/forward correctly opens/closes detail state.
- [ ] No duplicate nav controls on mobile breakpoints.

## 3) UI Clarity + Naming Cleanup (P1)

Issue: OWEN-28.

- [ ] Remove/rename confusing labels and temporary names (example: `SaveDeleteFeedback`).
- [ ] Standardize role naming in UI:
  - choose one: `Machinist/Finisher` vs `Primary/Collaborator` display vocabulary.
- [ ] Standardize copy for errors/toasts and read-only reason text.

Acceptance criteria:
- [ ] No internal/dev wording visible in user UI.
- [ ] Terminology is consistent in parts list, detail page, settings, and admin tools.

## 4) Live Update Strategy (P1)

Issue: OWEN-29.

- [ ] Define update model per surface:
  - Polling interval (current baseline) vs SSE/WebSocket for high-change views.
- [ ] Ensure claim/status/photo/owner changes propagate to all open views quickly.
- [ ] Add visual freshness indicator (last sync or reconnect state) if realtime channel used.

Acceptance criteria:
- [ ] Two clients show role claims/status updates without manual refresh.
- [ ] No stale ownership/status after successful mutation.

## 5) Import UX Consistency (P1)

Issues: OWEN-22, OWEN-23, OWEN-24, OWEN-25.

Current code appears to already include:
- filtered-out count in summary,
- active Team/Year/Robot filter display,
- row-level error text.

Candidate-close after QA:
- [ ] OWEN-23
- [ ] OWEN-24
- [ ] OWEN-25

Still to validate/fix:
- [ ] OWEN-22 synthetic parse error row numbering/labeling clarity.

Acceptance criteria:
- [ ] Modal and full-page import surfaces show equivalent diagnostics.
- [ ] Synthetic/non-row errors are visually distinct from real BOM row errors.

## 6) Contextual Action Visibility (P2)

Issue: OWEN-18.

- [ ] Hide `Add Part` and `Select Project` prompts in Account tab contexts where they are irrelevant.
- [ ] Ensure empty-state messaging is tab-specific and action-specific.

Acceptance criteria:
- [ ] Account tab shows account actions only.
- [ ] Project-dependent CTAs appear only in project/parts contexts.

## Suggested Execution Order

1. Role contract + OWEN-27/26 decision (prevents policy drift).
2. Mobile nav model (OWEN-17/19/21) with one canonical interaction.
3. Naming cleanup (OWEN-28) and contextual action cleanup (OWEN-18).
4. Live update pass (OWEN-29).
5. Import parity QA and close-out (OWEN-22/23/24/25).
