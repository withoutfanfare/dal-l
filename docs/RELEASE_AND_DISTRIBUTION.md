# Release and Distribution (macOS)

## Prerequisites

- Xcode Command Line Tools installed.
- Node and npm available in your shell.
- `OPENAI_API_KEY` available in environment.
- Apple signing/notarisation credentials configured if needed for your distribution flow.

## One-command release build

Run:

```bash
npm run release:mac
```

The script:

1. Installs dependencies (`npm ci`).
2. Verifies/rebuilds `better-sqlite3` native bindings for your current Node runtime.
3. Builds handbook database with `--force`.
4. Validates embeddings are present and complete.
5. Runs Tauri distribution build (`.app` and `.dmg`).
6. Fails if expected artifacts are missing.

## Artifact locations

- App bundle: `src-tauri/target/release/bundle/macos/*.app`
- DMG: `src-tauri/target/release/bundle/dmg/*.dmg`

## If build fails

See `docs/TROUBLESHOOTING.md` for common fixes (native module binding issues, missing embeddings, and DMG creation issues).
