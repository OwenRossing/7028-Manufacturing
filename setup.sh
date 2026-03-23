#!/usr/bin/env bash
# FRC Parts Tracker — one-shot setup script
# Usage:
#   bash setup.sh                        # interactive .env setup
#   bash setup.sh --env-url <url>        # pull .env from a private URL (e.g. GitHub Gist raw)
#   bash setup.sh --env-file <path>      # copy .env from an existing local file
#
# Curl-able (once hosted):
#   curl -fsSL https://<your-raw-url>/setup.sh | bash
#   curl -fsSL https://<your-raw-url>/setup.sh | bash -s -- --env-url <url>

set -euo pipefail

REPO_URL="https://github.com/OwenRossing/7028-Manufacturing.git"
REPO_DIR="7028-Manufacturing"
ENV_URL=""
ENV_FILE=""

# ── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-url)  ENV_URL="$2";  shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo "  [·] $*"; }
success() { echo "  [✓] $*"; }
warn()    { echo "  [!] $*"; }
die()     { echo "  [✗] $*" >&2; exit 1; }

require() {
  command -v "$1" &>/dev/null || die "'$1' is required but not installed. $2"
}

# ── Dependency checks ─────────────────────────────────────────────────────────
echo ""
echo "━━━ FRC Parts Tracker Setup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

require git  "Install via your package manager (apt/dnf/brew)."
require docker "Install from https://docs.docker.com/engine/install/"

# Docker Compose v2 (plugin) or v1 standalone
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  die "Docker Compose not found. Install the Docker Compose plugin."
fi
success "Dependencies OK (compose: $COMPOSE)"

# ── Clone or update repo ──────────────────────────────────────────────────────
if [[ -d "$REPO_DIR/.git" ]]; then
  info "Repo already cloned — pulling latest..."
  git -C "$REPO_DIR" pull --ff-only
elif [[ -f "package.json" && -f "prisma/schema.prisma" ]]; then
  info "Already inside the repo directory."
  REPO_DIR="."
else
  info "Cloning $REPO_URL..."
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
success "Repo ready at $(pwd)"

# ── .env setup ────────────────────────────────────────────────────────────────
if [[ -f ".env" ]]; then
  warn ".env already exists — skipping (delete it and re-run to reconfigure)."

elif [[ -n "$ENV_URL" ]]; then
  info "Downloading .env from URL..."
  curl -fsSL "$ENV_URL" -o .env
  success ".env downloaded."

elif [[ -n "$ENV_FILE" ]]; then
  info "Copying .env from $ENV_FILE..."
  cp "$ENV_FILE" .env
  success ".env copied."

else
  info "No .env found. Creating from .env.example..."
  cp .env.example .env

  echo ""
  echo "  ┌─ Configure your .env ──────────────────────────────────────────┐"
  echo "  │  Press Enter to keep the default shown in [brackets].          │"
  echo "  └────────────────────────────────────────────────────────────────┘"
  echo ""

  prompt_env() {
    local key="$1" default="$2" description="$3"
    read -rp "  $description [$default]: " value
    value="${value:-$default}"
    # Replace the line in .env (handles both quoted and unquoted values)
    sed -i "s|^${key}=.*|${key}=\"${value}\"|" .env
  }

  prompt_env "APP_MODE"         "demo"       "APP_MODE (demo/production)"
  prompt_env "GOOGLE_CLIENT_ID" ""           "GOOGLE_CLIENT_ID (leave empty to disable)"
  prompt_env "ADMIN_EMAILS"     ""           "ADMIN_EMAILS (comma-separated)"
  prompt_env "STORAGE_DRIVER"   "local"      "STORAGE_DRIVER (local/s3)"

  echo ""
  success ".env configured."
fi

# ── Docker Compose up ─────────────────────────────────────────────────────────
echo ""
info "Starting services with Docker Compose..."
$COMPOSE up -d --build

echo ""
echo "━━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  App:      http://localhost:3000"
echo "  DB port:  5432"
echo ""
echo "  Logs:     $COMPOSE logs -f web"
echo "  Stop:     $COMPOSE down"
echo ""
