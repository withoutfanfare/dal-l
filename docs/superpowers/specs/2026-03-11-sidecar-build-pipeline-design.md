# Sidecar Build Pipeline

**Date:** 2026-03-11
**Status:** Approved

## Problem

The production app cannot add/rebuild user projects because `run_project_build()` in `commands.rs` invokes `node tsx scripts/build-handbook.ts` — requiring `node_modules/tsx`, `better-sqlite3`, `unified`, `shiki`, and other Node dependencies that only exist in the development checkout.

## Solution

Compile `scripts/build-handbook.ts` into a standalone binary using `bun build --compile` and ship it as a Tauri sidecar. The Rust backend invokes the sidecar binary directly instead of `node + tsx`.

## Design

### 1. Bun Compile Step

A new npm script `build:sidecar` runs before `tauri build`:

```bash
bun build scripts/build-handbook.ts --compile --outfile src-tauri/binaries/build-handbook-aarch64-apple-darwin
```

Tauri sidecars require the binary name to end with the Rust target triple (e.g. `build-handbook-aarch64-apple-darwin`). The build script will detect the current platform and append the correct suffix.

A wrapper script `scripts/build-sidecar.sh` handles:
- Detecting the target triple from `rustc -vV`
- Running `bun build --compile` with the correct output path
- Making the binary executable

### 2. Tauri Configuration

In `tauri.conf.json`, register the sidecar:

```json
{
  "bundle": {
    "externalBin": ["binaries/build-handbook"]
  }
}
```

Tauri automatically appends the target triple when resolving the binary at runtime.

### 3. Rust Backend Changes

**`commands.rs` — `run_project_build()`:**

Replace the current `resolve_project_root()` + `tsx` + `node` approach with:

```rust
app.shell().sidecar("build-handbook")
    .args(["--source", source_path, "--output", db_path, ...])
    .output()
```

This eliminates:
- `resolve_project_root()` — no longer needed
- `resolve_node_binary()` — no longer needed
- `tsx_cli_path` check — no longer needed
- `rebuild_better_sqlite3()` — no longer needed (bun bundles its own copy)

**`execute_project_build_command()`** becomes a simple sidecar invocation.

The `--source`, `--output`, `--collection-id`, `--collection-name`, `--collection-icon` CLI args and optional `OPENAI_API_KEY` env var remain identical — the sidecar binary accepts the same interface.

### 4. Build Pipeline Integration

In `tauri.conf.json`, update `beforeBuildCommand`:

```json
"beforeBuildCommand": "npm run build:sidecar && npm run build:handbook && npm run build"
```

In `package.json`, add:

```json
"build:sidecar": "bash scripts/build-sidecar.sh"
```

### 5. Dev Mode

During `tauri dev`, the sidecar binary won't exist (and isn't needed since `node_modules` is available). The Rust code will attempt the sidecar first; if it fails (binary not found), it falls back to the existing `node + tsx` approach. This keeps the dev workflow unchanged.

### 6. Shell Permissions

The existing `shell:allow-execute` and `shell:allow-spawn` permissions in `capabilities/default.json` cover sidecar execution. A scoped permission for the specific sidecar name should be added:

```json
"shell:allow-execute"
```

Tauri v2 sidecar execution requires an explicit scope entry in the shell plugin config.

## Files to Create

- `scripts/build-sidecar.sh` — Wrapper to compile the sidecar binary

## Files to Modify

- `src-tauri/tauri.conf.json` — Add `externalBin`, update `beforeBuildCommand`
- `src-tauri/src/commands.rs` — Replace `run_project_build` internals with sidecar invocation, remove `resolve_project_root`, `resolve_node_binary`, `rebuild_better_sqlite3`
- `package.json` — Add `build:sidecar` script
- `src-tauri/capabilities/default.json` — Add sidecar shell scope if needed
- `.gitignore` — Ignore `src-tauri/binaries/`

## Out of Scope

- Cross-compilation (Linux/Windows targets) — macOS only for now
- Changing the build-handbook.ts script itself — it already supports CLI mode
- Changing the dev workflow — falls back to existing `node + tsx` path
