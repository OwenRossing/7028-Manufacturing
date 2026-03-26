#!/usr/bin/env node
/**
 * Development startup script  (npm run dev)
 *
 * 1. Starts the Docker Postgres container          (skipped inside Docker)
 * 2. Pushes the Prisma schema to the database
 * 3. Seeds demo data
 * 4. Starts the Next.js dev server
 * 5. On Ctrl-C: stops the Docker container and exits cleanly
 *
 * WSL users without Docker CLI integration: set DOCKER_CMD=docker.exe in your shell
 * before running, e.g.  DOCKER_CMD=docker.exe npm run dev
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'

const ROOT   = process.cwd()
const DOCKER = process.env.DOCKER_CMD ?? 'docker'

// ---------------------------------------------------------------------------
// Load .env into process.env (only keys not already set by the shell)
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = join(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key, raw] = m
    if (key in process.env) continue                   // shell wins
    if (raw.startsWith('#')) continue                  // comment-only value
    process.env[key] = raw.replace(/^["']|["']$/g, '') // strip surrounding quotes
  }
}

// ---------------------------------------------------------------------------
// Run a command synchronously; exit the process on failure
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
// Detect whether this process is already running inside a Docker container.
// If so, Docker-management steps are skipped — the compose file handles that.
// ---------------------------------------------------------------------------
const insideDocker = existsSync('/.dockerenv')

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
loadEnv()

console.log('\nFRC Parts Tracker -- dev\n')

if (insideDocker) {
  console.log('Inside Docker -- DB management handled by compose')
} else {
  run(DOCKER, ['compose', 'up', '-d', '--wait', 'db'], 'Starting database...')
}

run('npx', ['prisma', 'db', 'push'],  'Syncing schema...')
run('npx', ['tsx', 'prisma/seed.ts'], 'Seeding demo data...')

console.log('\nStarting dev server...\n')

const server = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: ROOT,
})

let cleaningUp = false

function cleanup() {
  if (cleaningUp) return
  cleaningUp = true

  if (!insideDocker) {
    console.log('\n\nStopping database...')
    spawnSync(DOCKER, ['compose', 'down'], { stdio: 'inherit', shell: true, cwd: ROOT })
    console.log('Done.')
  }

  process.exit(0)
}

process.on('SIGINT',  cleanup)
process.on('SIGTERM', cleanup)

// If next dev crashes (not from Ctrl-C), still clean up Docker
server.on('exit', () => { if (!cleaningUp) cleanup() })
