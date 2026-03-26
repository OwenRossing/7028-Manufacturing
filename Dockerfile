FROM node:22-alpine AS base
WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

# ── Development ────────────────────────────────────────────────────────────
# Mounts the host source tree via docker-compose volumes.
# npm run dev (scripts/dev.mjs) detects /.dockerenv and skips Docker management.
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Production build ───────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Production runtime ─────────────────────────────────────────────────────
# Slim image: compiled output + runtime deps only.
# npm run start (scripts/start.mjs) reads APP_MODE from the environment:
#   demo        -> db push + seed + next start   (reseeds every restart)
#   local       -> db push + next start          (Docker DB via compose, no seed wipe)
#   production  -> migrate deploy + next start   (external DB, no Docker)
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps    /app/node_modules  ./node_modules
COPY --from=builder /app/.next         ./.next
COPY --from=builder /app/public        ./public
COPY --from=builder /app/prisma        ./prisma
COPY --from=builder /app/scripts       ./scripts
COPY package.json package-lock.json*   ./
EXPOSE 3000
CMD ["npm", "run", "start"]
