# Prisma Offline Notes

## Why `prisma generate` can fail offline

`prisma generate` needs Prisma engine binaries. In restricted environments, the CLI cannot fetch those binaries and generation fails.

## What still works offline

- Running the app with an already-generated Prisma client.
- Linting, route type generation, TypeScript checks, and Next build using the current generated client.
- CI offline checks via `npm run ci:offline`.

## Offline-safe commands

- `npm run prisma:generate:if-present`
  - Runs generate only when a generated client directory and engine binary are already present.
  - Skips cleanly when they are missing.
- `npm run typecheck:offline`
- `npm run ci:offline`

## Full validation in a networked environment

When network access is available, run:

```bash
npm run prisma:generate
npm run typecheck
npm run build
```

This refreshes the generated client against `prisma/schema.prisma` and validates end-to-end.
