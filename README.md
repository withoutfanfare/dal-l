# dalīl

[![CI](https://github.com/withoutfanfare/dal-l/actions/workflows/ci.yml/badge.svg)](https://github.com/withoutfanfare/dal-l/actions/workflows/ci.yml)

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" alt="dalīl app icon" width="144" height="144">
</p>

Desktop knowledge app for viewing engineering handbooks and project documentation.

## Quick start

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

## Handbook database build

```bash
OPENAI_API_KEY=your_key_here npm run build:handbook -- --force
```

## macOS distribution build

Builds and validates the handbook DB, then creates `.app` and `.dmg` bundles.

```bash
OPENAI_API_KEY=your_key_here npm run release:mac
```

## Documentation

- User guide: `docs/APP_USER_GUIDE.md`
- Release process: `docs/RELEASE_AND_DISTRIBUTION.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
- Docs index: `docs/README.md`

## How this was built

dalīl was built with the help of AI coding agents, mainly Claude Code and Codex. Every change was reviewed and tested by Danny Harding before it was merged.

## Licence

MIT. See [LICENSE](LICENSE).
