#!/usr/bin/env node
/**
 * Smart production start script  (npm run start)
 *
 * Behaviour is controlled by APP_MODE in .env:
 *
 *   demo        ->  Docker DB up  +  db push  +  seed  +  next start
 *                   Ideal for a showcase/demo box. Reseeds on every restart.
 *
 *   local       ->  Docker DB up  +  db push  +  next start
 *                   Self-hosted machine where you manage the DB via Docker.
 *                   No seed wipe; schema kept in sync with db push.
 *
 *   production  ->  migrate deploy  +  next start                (default)
 *   (or unset)      DB is external (Railway, RDS, Supabase, etc.).
 *                   Uses proper migration history; never touches Docker.
 *
 * Override flags:
 *   SKIP_DOCKER=true      suppress Docker management regardless of APP_MODE
 *   DOCKER_CMD=docker.exe use docker.exe instead of docker (WSL without CLI integration)
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const ROOT   = process.cwd()
const DOCKER = process.env.DOCKER_CMD ?? 'docker'

// ---------------------------------------------------------------------------
// .env loader -- only fills keys not already set by the shell / compose
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (key in process.env) continue
    if (raw.startsWith('#')) continue
    process.env[key] = raw.replace(/^["']|["']$/g, '')
  }
}

// ---------------------------------------------------------------------------
// Synchronous command runner -- exits the process on failure
// ---------------------------------------------------------------------------
function run(cmd, args, label) {
  if (label) console.log(`\n${label}`)
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: ROOT })
  if (res.status !== 0) {
    console.error(`\nFailed: ${cmd} ${args.join(' ')}  (exit ${res.status ?? '?'})`)
    process.exit(res.status ?? 1)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
loadEnv()

const mode         = (process.env.APP_MODE || 'production').toLowerCase()
const insideDocker = existsSync('/.dockerenv')
const skipDocker   = insideDocker || process.env.SKIP_DOCKER === 'true'
const needsDocker  = mode === 'demo' || mode === 'local'

console.log(`\nFRC Parts Tracker -- ${mode} mode\n`)

// -- Docker DB ---------------------------------------------------------------
if (needsDocker && !skipDocker) {
  run(DOCKER, ['compose', 'up', '-d', '--wait', 'db'], 'Starting database...')
} else if (needsDocker && skipDocker) {
  console.log('Docker management skipped (inside container or SKIP_DOCKER=true)')
} else {
  console.log('Using external database (APP_MODE=production)')
}

// -- Schema / migrations -----------------------------------------------------
if (mode === 'production') {
  // migrate deploy is safe for managed DBs with proper migration history
  run('npx', ['prisma', 'migrate', 'deploy'], 'Applying migrations...')
} else {
  // db push keeps the schema in sync without requiring migration history.
  // Works correctly whether the DB is fresh or already has tables.
  // --accept-data-loss allows dropping tables (schema has breaking changes).
  run('npx', ['prisma', 'db', 'push', '--accept-data-loss'], 'Syncing schema...')
  if (mode === 'demo') {
    run('npx', ['tsx', 'prisma/seed.ts'], 'Seeding demo data...')
  }
}

// -- Next.js -----------------------------------------------------------------
console.log('\nStarting server...\n')

const server = spawn('npx', ['next', 'start'], {
  stdio: 'inherit',
  shell: true,
  cwd: ROOT,
})

server.on('exit', code => process.exit(code ?? 0))
