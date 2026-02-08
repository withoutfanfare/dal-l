# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is dalil?

A desktop engineering handbook viewer built with Tauri 2 (Rust) + Vue 3 + TypeScript + Tailwind CSS v4. It ingests markdown collections into a SQLite database at build time and presents them with full-text search, keyboard navigation, and optional AI-powered Q&A (RAG with OpenAI, Anthropic, or Ollama).

## Commands

```bash
# Frontend dev server (port 1420)
npm run dev

# Full Tauri dev (opens native window with hot-reload)
npm run tauri dev

# Rebuild the SQLite database from markdown sources
npm run build:handbook

# Type-check + production frontend build
npm run build

# Full production build (rebuilds handbook DB + frontend + Tauri bundle)
npm run tauri build
```

There are no test or lint commands configured.

## Architecture

### Three-layer stack

1. **Build-time pipeline** (`scripts/build-handbook.ts` + `scripts/lib/`) — Node.js script reads markdown collections defined in `dalil.config.ts`, processes them through unified/remark/rehype with Shiki syntax highlighting, chunks content for RAG, and writes everything to `dalil.db` (SQLite with FTS5).

2. **Rust backend** (`src-tauri/src/`) — Tauri 2 commands expose read-only SQLite queries to the frontend. Modules: `db.rs` (connection init), `commands.rs` (10 Tauri commands), `models.rs` (serde structs), `ai.rs` (RAG pipeline with streaming), `settings.rs` (Tauri store persistence).

3. **Vue frontend** (`src/`) — Vue 3 with `<script setup lang="ts">`, Vue Router, 15+ composables, and Tailwind CSS v4 theming.

### Data flow

```text
dalil.config.ts → build-handbook.ts → dalil.db → Rust commands → Vue frontend
```

The database is bundled as a Tauri resource. In dev mode, `db.rs` reads from the project root; in production, from the app bundle.

### Frontend structure

- `src/lib/api.ts` — All Tauri `invoke()` calls (typed wrappers)
- `src/lib/types.ts` — TypeScript interfaces matching Rust models
- `src/composables/` — Composition API hooks (search, navigation, theme, AI, keyboard, etc.)
- `src/components/` — Organised by domain: `sidebar/`, `content/`, `search/`, `ai/`, `settings/`
- `src/pages/` — Three route pages: `HomePage`, `DocPage`, `TagPage`
- `src/router/index.ts` — Routes: `/`, `/tags/:tag`, `/:collection/:slug(.*)`

### Tauri commands (frontend ↔ backend API)

`get_collections`, `get_navigation`, `get_document`, `search_documents`, `get_tags`, `get_similar_chunks`, `get_settings`, `save_settings`, `test_provider`, `ask_question`, `get_embedding`

### Content pipeline details

- Collections are defined in `dalil.config.ts` (source directories with id/name/icon)
- `README.md` and `*-index.md` in the same directory produce the same slug — the pipeline deduplicates by preferring `*-index.md`
- Internal `.md` links are resolved to app slugs via a custom remark plugin (`remark-resolve-links.ts`)
- Documents are chunked (~500 tokens, 50-token overlap) for RAG vector search

## Key conventions

- **Vue components**: `<script setup lang="ts">` with Composition API exclusively
- **Path alias**: `@/` maps to `./src/`
- **Styling**: Tailwind CSS v4 with `@theme` directive for colour tokens in `src/style.css`. Class-based dark mode via `.dark` on `<html>`
- **Design language**: Things (Mac app) inspired — warm paper-like surfaces, shadows over borders, micro-animations, generous whitespace
- **macOS native**: Transparent titlebar with overlay traffic lights (`macOSPrivateApi: true` in Cargo.toml)
- **British English**: All user-facing text and documentation

## Important gotchas

- **FTS5**: Use standalone FTS5 table with manual inserts. Do NOT use `content='documents'` — column name mismatch breaks it.
- **Tauri icons**: Must be RGBA (colour type 6), not RGB, or the build fails.
- **`db.rs` path resolution**: Uses `path.pop()` when cwd is `src-tauri/` during dev to find `dalil.db` in project root.
- **`@types/better-sqlite3`**: Use `^7.6.13` (not 14). Use `@shikijs/rehype` not `rehype-shiki`.
- **TypeScript**: `useDefineForExpose` is not a valid compiler option — don't add it.
- **Tauri resources**: Must be an empty array in bundle config if no extra files exist yet.

## Database schema (SQLite)

Core tables: `collections`, `documents`, `tags`, `document_tags`, `navigation_tree`
Search: `documents_fts` (FTS5 virtual table)
RAG: `chunks`, `chunk_embeddings`, `chunks_fts`
