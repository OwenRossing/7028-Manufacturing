# Permissions Matrix

This defines what each role can do in the current app behavior.

## User states

### Signed out
- Can view pages and part data.
- Cannot claim roles.
- Cannot edit status, owners, details, or media.

### Signed in non-admin, not assigned to part
- Can claim machinist if machinist is unassigned.
- Can claim finisher if finisher slot is unassigned.
- Cannot edit status, owners, details, or media until assigned.

### Signed in non-admin, assigned to part
- Can edit part details.
- Can edit status transitions (subject to validation rules).
- Can update owners for that part.
- Can upload/delete media for that part.
- Can set thumbnail for that part.

### Admin
- Can manage all parts regardless of assignment.
- Can access admin-only features:
  - project administration
  - config administration
  - admin users panel
  - import/onshape admin endpoints

## Status/validation constraints

- Transition rules are controlled by `lib/status.ts`.
- Setting status to `DONE` requires at least one photo.
- Idempotency key is supported for mutation routes that use it.

## Notes

- "Can claim role" and "can edit part" are intentionally separate.
- Claiming a role grants assignment, which grants edit access for non-admin users.
