# Optimisation Audit Report

**Date:** 2026-02-08
**Scope:** Full-stack audit of dalil (Tauri 2 + Vue 3 + Rust + SQLite)
**Audited by:** 3 specialist agents (frontend, backend, build pipeline)

---

## Critical / Bug

### B1. DOMPurify strips Shiki `style` attributes — syntax highlighting is broken
**File:** `src/lib/sanitise.ts:22-29`
**Issue:** The `ALLOWED_ATTR` list does not include `'style'`. Shiki generates per-token inline styles with CSS custom properties (`--shiki-light`, `--shiki-dark`), which DOMPurify silently strips. This means syntax highlighting falls back to bare CSS rules rather than the per-token colours Shiki computed at build time. The code blocks appear monochrome or incorrectly coloured.
**Recommendation:** Add `'style'` to the `ALLOWED_ATTR` array in `sanitise.ts`. Since the HTML is pre-rendered at build time (not user-generated), this is safe. Alternatively, use a DOMPurify hook to allow only CSS custom properties.
**Effort:** Very low (one-line fix)

---

## High Impact

### 1. AI streaming response re-renders HTML on every character
**File:** `src/components/ai/AskResponse.vue:17-45`
**Issue:** The `renderedHtml` computed runs 9 regex replacements + `sanitiseHtml()` (DOMPurify) on every reactive update to `props.response`. During AI streaming, `response` is appended character-by-character via the `ai-response-chunk` event (`src/composables/useAI.ts:55-56`), meaning every chunk triggers a full recomputation: regex chain + DOMPurify parse + innerHTML replacement. A 2,000-character response could produce hundreds of full HTML parses.
**Recommendation:** Debounce the rendering during streaming — batch chunks and recompute every 100-150ms using `requestAnimationFrame` or a timeout. Alternatively, display plain text during streaming and convert to HTML only on `ai-response-done`.
**Effort:** Low-Medium

### 2. `reqwest::Client` is rebuilt on every AI request
**File:** `src-tauri/src/ai.rs:58-61, 109-112, 150-153, 489-492, 590-593, 679-682, 748-751, 774-777`
**Issue:** Every AI function (embedding, streaming, provider testing) builds a fresh `reqwest::Client`. This discards TCP connection pools, TLS session caches, and HTTP/2 multiplexing. Each request incurs a fresh TCP + TLS handshake.
**Recommendation:** Create a single `reqwest::Client` at app startup, store in Tauri managed state (alongside `DbState`), inject into commands. One-time setup, permanent benefit.
**Effort:** Low

### 3. Mutex contention blocks all DB access during AI queries
**File:** `src-tauri/src/db.rs:5`, `src-tauri/src/ai.rs:842-853`
**Issue:** All database access goes through `Mutex<Connection>`. During `ask_question_rag()`, the Mutex is held for the entire hybrid search (vector similarity over all embeddings + FTS). All other commands (navigation, document loading, search) are blocked.
**Recommendation:** Since the database is opened `SQLITE_OPEN_READ_ONLY`, concurrent reads are safe. Replace `Mutex` with `RwLock` (all operations are reads), or open multiple read-only connections. `RwLock` is a one-line change with significant concurrency improvement.
**Effort:** Low (RwLock) / Medium (connection pool)

### 4. Sidebar resize fires `localStorage.setItem()` on every pixel of movement
**File:** `src/layouts/AppLayout.vue:39-41`, `src/composables/useSidebar.ts:32-35`
**Issue:** `onResizeMove` calls `setSidebarWidth()` on every `mousemove` event during drag. This triggers: (1) reactive ref update, (2) synchronous `localStorage.setItem()`, (3) layout recalculation via `:style` binding — all per pixel of mouse movement.
**Recommendation:** Throttle `onResizeMove` with `requestAnimationFrame`. Debounce the `localStorage.setItem()` to fire only on `mouseup`.
**Effort:** Low

### 5. Build pipeline processes markdown files sequentially
**File:** `scripts/build-handbook.ts:136-193`
**Issue:** Each markdown file is processed one at a time (`for...of` with `await`). The unified pipeline (parsing, remark, rehype, Shiki) is CPU-bound and could benefit from parallelism.
**Recommendation:** Process files in parallel batches via `Promise.all()` with a concurrency limit (e.g., 8-10). SQLite writes must remain serial, so separate "process markdown" from "insert into DB".
**Effort:** Medium

### 6. Shiki processor is recreated for every file AND loads all 343 languages
**File:** `scripts/build-handbook.ts:142-153`
**Issue:** A new `unified()` pipeline with `rehypeShiki` is instantiated per file. Furthermore, `rehypeShiki` is configured without a `langs` option, causing Shiki to load all 343 bundled language grammars (~7.6 MB on disk) when only 7 are actually used in the handbook content (bash, text, php, markdown, yaml, neon, ini). While `getSingletonHighlighter` shares the highlighter across files, the initial load still includes 336 unnecessary grammars.
**Recommendation:**
1. Pass an explicit `langs` array: `langs: ['bash', 'text', 'php', 'markdown', 'yaml', 'ini', 'neon']`
2. Create the processor once outside the loop. The `remarkResolveLinks` plugin needs per-file options, but Shiki/GFM/slug/stringify can share a base processor.
**Effort:** Low-Medium

### 7. No outer transaction wrapping document inserts — 88 transactions per build
**File:** `scripts/build-handbook.ts:136-193`, `scripts/lib/create-database.ts:131-157`
**Issue:** Each `insertDocument` call creates its own transaction (43 documents = 43 transactions). `insertChunks` creates a separate transaction per document's chunks (another 43). Total: 1 (collection) + 43 (documents) + 43 (chunks) + 1 (navigation) = 88 transactions, each requiring a WAL fsync.
**Recommendation:** Wrap the entire `processCollection` file-processing loop in a single outer transaction. This reduces 88 transactions to 1, eliminating per-document fsync overhead.
**Effort:** Low

### 8. `beforeBuildCommand` always rebuilds handbook (13s) even when content unchanged
**File:** `src-tauri/tauri.conf.json:9`
**Issue:** `"beforeBuildCommand": "npm run build:handbook && npm run build"` always runs `build:handbook` (~13s) before the frontend build, even if no markdown files have changed.
**Recommendation:** Add a staleness check to `build:handbook` — compare `dalil.db` mtime against source markdown files. Skip if database is newer. Alternatively, split into `build:handbook:check` and `build:handbook:force`.
**Effort:** Low

### 9. Vector search loads all embeddings on every query (brute-force)
**File:** `src-tauri/src/ai.rs:210-258`
**Issue:** `vector_search()` fetches every row from `chunk_embeddings`, decodes every BLOB, computes cosine similarity for all, then sorts and truncates. Additionally, a redundant `COUNT(*)` check (line 200-208) does a full table scan just to see if the table is empty before the main scan.
**Recommendation:** For current dataset (~119 chunks) this is fine. Remove the redundant `COUNT(*)` check (the subsequent query handles empty tables correctly). For future scaling (1,000+ chunks), consider `sqlite-vec`, cached embeddings, or a two-pass approach (score first, load text for top-N only).
**Effort:** Very low (COUNT removal) / High (architectural change)

---

## Medium Impact

### 10. Prepared statements not cached in Rust commands
**File:** `src-tauri/src/commands.rs` (all command functions)
**Issue:** Every invocation of `get_collections`, `get_navigation`, `get_document`, `search_documents`, and `get_tags` calls `conn.prepare(...)` which parses and compiles SQL fresh. For the same queries running repeatedly, this is wasted work.
**Recommendation:** Use `conn.prepare_cached(...)` instead of `conn.prepare(...)`. rusqlite's `prepare_cached` maintains an LRU cache of compiled statements. This is a one-word change per call site.
**Effort:** Very low

### 11. SSE stream buffer handling creates excessive allocations
**File:** `src-tauri/src/ai.rs:523-525, 618-620, 704-706`
**Issue:** In all three streaming functions, every SSE line creates two String allocations: one for the line itself and one for the remaining buffer (copying all remaining bytes).
**Recommendation:** Use `buffer.drain(..line_end + 1)` or track a cursor offset. Alternatively, use a `BufReader` or the `eventsource-stream` crate for proper SSE parsing.
**Effort:** Low

### 12. `get_document` returns `content_raw` unnecessarily
**File:** `src-tauri/src/commands.rs:72-74`
**Issue:** The `get_document` command always fetches both `content_html` and `content_raw`. The raw content is only needed for RAG chunking (done at build time) — it appears unused in the frontend display path. This roughly doubles the IPC payload for every document view.
**Recommendation:** Omit `content_raw` from the SELECT in `get_document`, or add a separate command for when raw content is needed.
**Effort:** Low

### 13. `fts_chunk_search` checks `sqlite_master` on every call
**File:** `src-tauri/src/ai.rs:293-300`
**Issue:** Every call runs `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='chunks_fts'` to check if the FTS table exists. The database is read-only — its schema never changes at runtime.
**Recommendation:** Check once at startup (or lazily on first call) and cache the result as a boolean.
**Effort:** Very low

### 14. Background blobs run continuous GPU animations
**File:** `src/style.css:349-414`, `src/layouts/AppLayout.vue:138-142`
**Issue:** Three 600x600px elements with `filter: blur(80px)` animate continuously with 20-30s infinite CSS keyframe animations. They use `will-change: transform` and `contain: strict` (good), but run even when the window is hidden or the user is reading.
**Recommendation:** Pause animations when the window is not visible using the `visibilitychange` event. Alternatively, use a static blurred background image.
**Effort:** Low

### 15. `useNavigation` watcher duplicates on every composable call
**File:** `src/composables/useNavigation.ts:60-62`
**Issue:** Every call to `useNavigation()` registers a new `watch(activeCollectionId, ...)` with `{ immediate: true }`. Since composable calls happen per-component, duplicate watchers accumulate. The cache Map mitigates redundant API calls, but duplicate watchers still fire.
**Recommendation:** Move the watcher registration to module scope (outside the exported function), matching the pattern used by `useSearch`, `useTheme`, and `useSidebar`.
**Effort:** Low

### 16. Four global keydown listeners compete without coordination
**File:** `src/composables/useCommandPalette.ts:18-31`, `src/composables/useKeyboardShortcuts.ts`, `src/components/ai/AskPanel.vue`, `src/components/settings/SettingsModal.vue`
**Issue:** Four separate `window.addEventListener('keydown', ...)` handlers fire on every keypress. Escape key handling uses fragile priority checks (`e.defaultPrevented`, checking `aiOpen.value`).
**Recommendation:** Consolidate into a single keydown dispatcher or use a small event bus. Not urgent but reduces per-keypress overhead and eliminates the fragile priority logic.
**Effort:** Medium

---

## Low Impact

### 17. Search results run DOMPurify on backend-generated snippets
**File:** `src/components/search/SearchResult.vue:11-13`
**Issue:** Each `SearchResult` runs `sanitiseHtml()` via a computed for the snippet. Snippets come from FTS5 which only produces `<mark>` tags — known-safe backend output. With 20 results visible, that is 20 DOMPurify passes per search.
**Recommendation:** Use a lighter sanitiser for search snippets (e.g., allow only `<mark>` tags) or skip purification for these known-safe backend snippets.
**Effort:** Low

### 18. `is_ollama_available` makes a full HTTP request each time
**File:** `src-tauri/src/ai.rs:144-156`
**Issue:** Called in the embedding fallback chain for Anthropic. Makes a GET request with a 2-second timeout. If Ollama is down, this adds 2 seconds of latency before falling through.
**Recommendation:** Cache the availability status with a TTL (e.g., 30 seconds).
**Effort:** Low

### 19. Duplicate query logic in `search_documents` and `get_tags`
**File:** `src-tauri/src/commands.rs:109-162, 171-216`
**Issue:** Both functions have near-identical code paths for "with collection_id" vs "without". Not a direct performance issue, but doubles the number of prepared statements.
**Recommendation:** Use a single query with `WHERE (? IS NULL OR d.collection_id = ?)`, or rely on `prepare_cached` (finding #8) which mitigates this naturally.
**Effort:** Low

### 20. `SidebarSection` renders collapsed subtrees with `v-show`
**File:** `src/components/sidebar/SidebarSection.vue:38-42`
**Issue:** Recursive sidebar rendering uses `v-show` for collapsed sections, keeping ~100 `SidebarLink` components in the DOM even when hidden. Using `v-if` would avoid rendering hidden subtrees entirely.
**Recommendation:** Switch from `v-show` to `v-if` for collapsed sections. Trade-off: slightly slower expand animation, but smaller initial DOM.
**Effort:** Very low

### 21. Multiple watchers on same prop in DocumentView
**File:** `src/components/content/DocumentView.vue:16-49`
**Issue:** Two `watch()` calls both observe `props.document.slug`. Could be combined into a single watcher.
**Recommendation:** Combine into one watcher for cleaner code. Saves one reactive subscription.
**Effort:** Very low

### 22. Unused Tauri plugins add binary size
**File:** `src-tauri/Cargo.toml:24, 27`
**Issue:** `tauri-plugin-updater` is listed as a dependency but the plugin initialisation appears commented out in `lib.rs`. `tauri-plugin-deep-link` is initialised but no handler is registered for incoming deep links.
**Recommendation:** Either remove the unused dependencies or complete their integration.
**Effort:** Very low

### 23. Anthropic model version is pinned
**File:** `src-tauri/src/ai.rs:580, 779`
**Issue:** Hardcoded to `claude-sonnet-4-20250514`. Will become outdated.
**Recommendation:** Make the model configurable in settings. Not a performance issue but affects maintainability.
**Effort:** Low

---

## Positive Findings (things done well)

- **Route lazy loading**: All three pages use dynamic `import()` (`src/router/index.ts:9-20`)
- **Search debouncing**: 150ms debounce with request ID tracking (`src/composables/useSearch.ts`)
- **Navigation caching**: Client-side cache by collection ID (`src/composables/useNavigation.ts:10`)
- **Singleton state pattern**: Most composables use module-level refs for shared state
- **IntersectionObserver for ToC**: Efficient scroll-based heading tracking (`src/composables/useTableOfContents.ts`)
- **CSS containment**: `contain: strict` on blobs, `contain: content` on main area
- **Proper event listener cleanup**: `onUnmounted` handlers remove listeners correctly
- **Bounded caches**: HTML cache (30 entries) and scroll positions (100 entries) have eviction
- **Small dependency footprint**: Only 7 runtime dependencies, all tree-shakeable
- **Database opened read-only**: `SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX` is correct
- **Release profile**: `opt-level = 3`, `lto = true`, `strip = true`, `codegen-units = 1`, `panic = "abort"` — optimal
- **WAL mode**: Enabled for build-time writes (`scripts/lib/create-database.ts:11`)
- **Transactions**: Batch inserts use transactions correctly
- **Schema indexes**: All key query paths have appropriate indexes

---

## Build Metrics Baseline

| Metric | Value |
|--------|-------|
| Handbook build time | ~13 seconds (43 markdown files) |
| Vite build time | ~3.1 seconds (103 modules) |
| JS bundle (main) | 164.4 KB raw / 62.5 KB gzip |
| JS bundle (lazy pages) | 12.5 KB total |
| CSS bundle | 69.8 KB raw / 11.4 KB gzip |
| Database | 1.5 MB (dalil.db) |
| Shiki on disk | ~17 MB (343 langs + themes) |
| Total npm packages | 344 |

---

## Summary

| Priority   | Count | Key themes |
|------------|-------|------------|
| Critical   | 1     | DOMPurify stripping Shiki styles (correctness bug) |
| High       | 9     | AI streaming render, HTTP client reuse, Mutex contention, sidebar resize, build parallelism, Shiki langs, transaction batching, stale rebuild |
| Medium     | 7     | Statement caching, IPC payload, animation pausing, watcher dedup |
| Low        | 7     | Snippet sanitisation, collapsed sidebar rendering, unused plugins |

### Top 7 recommendations (highest ROI)

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Add `'style'` to DOMPurify `ALLOWED_ATTR` | Fixes broken syntax highlighting | 1 line |
| 2 | Reuse `reqwest::Client` via Tauri managed state | Eliminates repeated TLS handshakes | Low |
| 3 | Use `prepare_cached` instead of `prepare` in Rust commands | Eliminates repeated SQL parsing | Very low |
| 4 | Pass explicit `langs` array to Shiki (7 vs 343) | Faster build initialisation | 1 line |
| 5 | Wrap all inserts in a single outer transaction | 88 transactions down to 1 | Low |
| 6 | Debounce AI streaming HTML rendering | Prevents hundreds of DOMPurify passes | Low |
| 7 | Add staleness check to `beforeBuildCommand` | Saves ~13s when content unchanged | Low |

### Architecture note

The codebase is well-structured with good patterns already in place. Most performance findings are either scaling concerns (relevant if the corpus grows 10x+) or minor improvements. The application is well-optimised for its current 93-document, 119-chunk corpus. The one critical finding (B1) is a correctness bug rather than a performance issue.
