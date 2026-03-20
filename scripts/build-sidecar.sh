#!/usr/bin/env bash
set -euo pipefail

# Detect the Rust target triple for Tauri sidecar naming
TARGET_TRIPLE=$(rustc -vV | grep '^host:' | cut -d' ' -f2)

if [ -z "$TARGET_TRIPLE" ]; then
  echo "Error: could not detect Rust target triple from 'rustc -vV'" >&2
  exit 1
fi

OUTFILE="src-tauri/binaries/build-handbook-${TARGET_TRIPLE}"

echo "Building sidecar for ${TARGET_TRIPLE}..."
bun build scripts/build-handbook.ts --compile --outfile "$OUTFILE"
chmod +x "$OUTFILE"
echo "Sidecar built: ${OUTFILE}"
