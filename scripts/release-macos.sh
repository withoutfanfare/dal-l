#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

log "Starting macOS distribution build"

require_cmd node
require_cmd npm
require_cmd sqlite3
require_cmd hdiutil

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  fail "OPENAI_API_KEY is required to generate handbook embeddings."
fi

log "Node: $(node -v)"
log "npm: $(npm -v)"

log "Installing dependencies with npm ci"
npm ci

log "Validating better-sqlite3 native binding"
if node -e "require('better-sqlite3')" >/dev/null 2>&1; then
  log "better-sqlite3 binding is available"
else
  log "Rebuilding better-sqlite3 for current Node runtime"
  npm rebuild better-sqlite3 --build-from-source
  node -e "require('better-sqlite3')"
  log "better-sqlite3 binding rebuilt successfully"
fi

log "Building handbook database (forced)"
npm run build:handbook -- --force

CHUNK_COUNT="$(sqlite3 dalil.db "SELECT COUNT(*) FROM chunks;")"
EMBEDDING_COUNT="$(sqlite3 dalil.db "SELECT COUNT(*) FROM chunk_embeddings;")"

log "Chunk count: $CHUNK_COUNT"
log "Embedding count: $EMBEDDING_COUNT"

if [[ "$CHUNK_COUNT" -eq 0 ]]; then
  fail "No chunks were generated in dalil.db."
fi

if [[ "$EMBEDDING_COUNT" -lt "$CHUNK_COUNT" ]]; then
  fail "Embeddings are incomplete ($EMBEDDING_COUNT/$CHUNK_COUNT)."
fi

log "Running Tauri distribution build (app + dmg)"
npm run tauri:build:dist

APP_PATH="$(find src-tauri/target/release/bundle -type d -name '*.app' | head -n 1 || true)"
DMG_PATH="$(find src-tauri/target/release/bundle -type f -name '*.dmg' | head -n 1 || true)"

[[ -n "$APP_PATH" ]] || fail "No .app artifact found in src-tauri/target/release/bundle."
[[ -n "$DMG_PATH" ]] || fail "No .dmg artifact found in src-tauri/target/release/bundle."

log "Build complete"
log "App: $APP_PATH"
log "DMG: $DMG_PATH"
