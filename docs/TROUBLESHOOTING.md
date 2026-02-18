# Dalil Troubleshooting

## Handbook build fails with `better-sqlite3` binding errors

Symptoms:

- "Could not locate the bindings file"
- ABI mismatch errors (`NODE_MODULE_VERSION` mismatch)

Fix:

```bash
npm ci
npm rebuild better-sqlite3 --build-from-source
node -e "require('better-sqlite3'); console.log('ok')"
```

Then run:

```bash
npm run build:handbook -- --force
```

## Embeddings are zero after build

Check counts:

```bash
sqlite3 dalil.db "select count(*) from chunks; select count(*) from chunk_embeddings;"
```

If `chunk_embeddings` is lower than `chunks`:

1. Confirm `OPENAI_API_KEY` is set in the same shell session.
2. Re-run handbook build with force:

```bash
npm run build:handbook -- --force
```

## DMG build fails (`hdiutil` errors)

Common causes:

- Local macOS disk/config issue.
- Running inside constrained sandbox/CI environment.

Fixes:

- Run build directly on local macOS user session (not sandboxed).
- Check free disk space.
- Retry after cleaning old bundle outputs:

```bash
rm -rf src-tauri/target/release/bundle
npm run tauri:build:dist
```

## Search returns no useful results

Likely causes:

- Stale project DB.
- Empty chunk table.

Fix:

1. Rebuild from Projects page in app.
2. Or run:

```bash
npm run build:handbook -- --force
```
