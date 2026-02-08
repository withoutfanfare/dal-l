# Full Bug Hunt Report — dalil

**Date:** 2026-02-08
**Scope:** Rust backend (`src-tauri/src/`), Vue frontend (`src/`), build pipeline (`scripts/`), configuration files
**Method:** Three-agent parallel audit (Rust, Vue, pipeline/config)

---

## Executive Summary

**60 findings** across the full codebase. No show-stopping crashes in production, but a cluster of AI streaming issues, an XSS surface, and several incomplete features need attention.

**Top risks:**
1. AI streaming has no cancellation, race conditions in listener setup, and silently dropped errors — users can get interleaved responses, hangs, or wasted API tokens.
2. XSS surface via `v-html` on AI responses with `style` attribute in DOMPurify allowlist, compounded by a null CSP in the Tauri webview.
3. FTS5 queries pass user input directly to MATCH — special characters produce cryptic SQLite errors.

**Quick wins:** Remove `style` from sanitiser allowlist, add request timeouts to all `reqwest` clients, delete unused `render-markdown.ts`, sanitise FTS5 input.

---

## Findings by Severity

### Critical (1)

#### C-01: XSS via `v-html` on AI-streamed content
- **File:** `src/components/ai/AskResponse.vue:17-44`
- **Description:** AI responses are converted from markdown to HTML using regex, then rendered via `v-html` after DOMPurify. The regex conversion is fragile on partial streaming chunks and produces malformed HTML. The DOMPurify config in `src/lib/sanitise.ts:26` includes `style` in the allowed attributes, enabling CSS-based exfiltration or UI redress attacks if an AI provider returns adversarial content.
- **Impact:** Potential XSS or UI manipulation from AI-generated content. Amplified by null CSP (see H-13).
- **Recommendation:** Remove `style` from the DOMPurify `ALLOWED_ATTR` list. Consider replacing the regex markdown conversion with a proper markdown library, or at minimum render after the full response is received rather than on each streaming chunk.
- **Effort:** S
- **See also:** Previous hunt BH-001, BH-002.

---

### High (15)

#### H-01: No cancellation on rapid AI re-ask
- **File:** `src/composables/useAI.ts:39-77`
- **Description:** Calling `ask()` while a previous request is still streaming leaves old event listeners active. The old `unlistenChunk`, `unlistenDone`, and `unlistenError` closures remain registered and continue appending chunks from the old request to `response.value`.
- **Impact:** Interleaved AI responses from concurrent requests, corrupted displayed text, and orphaned event listeners that are never cleaned up.
- **Recommendation:** Store unlisten functions in a ref. At the start of `ask()`, call any existing unlisten functions before registering new ones. Add a guard that prevents concurrent requests, or cancel the previous one.
- **Effort:** S

#### H-02: Race condition in AI listener setup
- **File:** `src/composables/useAI.ts:48-76`
- **Description:** Three sequential `await listen()` calls register event listeners one at a time, and only after all three are registered does the code call `askQuestion()`. If the Rust backend processes the question and emits events very quickly (e.g. Ollama local models), the first events could be emitted before the third listener is registered.
- **Impact:** Truncated or missing AI responses, particularly with fast local models.
- **Recommendation:** Register all three listeners concurrently with `Promise.all([listen(...), listen(...), listen(...)])`, then call `askQuestion()`.
- **Effort:** S

#### H-03: Silently swallowed row errors in vector/FTS search
- **File:** `src-tauri/src/ai.rs:210`, `ai.rs:299`, `ai.rs:338`
- **Description:** `.filter_map(|r| r.ok())` silently discards any rows that fail to deserialise from SQLite. If a row has corrupt data, a NULL in a NOT NULL column, or a malformed embedding blob, the error is silently swallowed.
- **Impact:** Search results may silently omit valid data. Debugging data issues is very difficult because there is no indication rows were dropped.
- **Recommendation:** Replace with `.map(|r| r).collect::<Result<Vec<_>, _>>()?` to propagate errors, or at minimum log discarded rows with `eprintln!` or `tracing::warn!`.
- **Effort:** S

#### H-04: All `app.emit()` failures silently ignored during AI streaming
- **File:** `src-tauri/src/ai.rs` — 9 locations (lines 492, 498, 505, 583, 587, 597, 659, 663, 670)
- **Description:** All `app.emit()` calls use `let _ = app.emit(...)` which discards emission errors. If the frontend window is closed during streaming, the backend continues generating the full response (making API calls and consuming tokens) without the user ever seeing the output.
- **Impact:** Wasted API tokens and compute. No cancellation mechanism exists.
- **Recommendation:** Check emit results. If emit fails, break out of the streaming loop. Consider adding a cancellation token or `AbortController`-style mechanism.
- **Effort:** M

#### H-05: Lost error path in `ask_question`
- **File:** `src-tauri/src/commands.rs:290`
- **Description:** When `ask_question_rag` fails, the error is emitted as an event with `let _ = tauri::Emitter::emit(...)`. The command itself always returns `Ok(())`. If the emit also fails (window closed, serialisation issue), the error is completely lost.
- **Impact:** The user asks a question and never gets any response or error feedback. The UI appears to hang indefinitely.
- **Recommendation:** Return the error through the command's `Result` type in addition to emitting it, or at minimum log emit failures.
- **Effort:** S

#### H-06: Mutex poisoning permanently breaks all DB operations (debug mode)
- **File:** `src-tauri/src/commands.rs` (all handlers)
- **Description:** Every command handler uses `db.0.lock().map_err(|e| e.to_string())?`. If any thread panics while holding the Mutex lock, it becomes permanently poisoned. All subsequent Tauri commands return "poisoned lock" errors.
- **Impact:** A single panic in any DB code path permanently breaks the entire application until restart. Mitigated by `panic = "abort"` in release profile, so this is primarily a debug-mode concern.
- **Recommendation:** Consider using `parking_lot::Mutex` which does not poison, or handle the poisoned state by recovering the inner value.
- **Effort:** S

#### H-07: `SQLITE_OPEN_NO_MUTEX` + Rust Mutex is a refactoring footgun
- **File:** `src-tauri/src/db.rs:23-26`
- **Description:** The database is opened with `SQLITE_OPEN_NO_MUTEX` (disabling SQLite's internal thread-safety) and relies entirely on the Rust `Mutex<Connection>`. This is correct today, but if anyone accesses the `Connection` outside the Mutex in a future refactor, there will be undefined behaviour in SQLite.
- **Impact:** No current bug, but high risk of future data corruption if the Mutex wrapper is bypassed.
- **Recommendation:** Remove the `NO_MUTEX` flag and let SQLite handle its own thread safety as a defence-in-depth measure. Or add a clear comment explaining the invariant.
- **Effort:** S

#### H-08: Navigation cache never invalidated
- **File:** `src/composables/useNavigation.ts:10`, `useNavigation.ts:42-47`
- **Description:** The navigation cache (`Map<string, NavigationNode[]>`) is populated on first load and never cleared. If the database is updated while the app is running (rebuild, app update with new content), the sidebar shows stale data until restart.
- **Impact:** Stale sidebar navigation after content changes.
- **Recommendation:** For a desktop app with bundled DB this is low-urgency, but consider adding a cache-bust mechanism (e.g. check a version/timestamp in the DB on focus).
- **Effort:** M

#### H-09: Collections never re-fetched
- **File:** `src/composables/useCollections.ts:11`
- **Description:** The `loaded` flag prevents `loadCollections()` from ever re-fetching. Compounds the stale navigation issue (H-08).
- **Impact:** Same as H-08 — stale data for the app lifetime.
- **Recommendation:** Same approach as H-08.
- **Effort:** S

#### H-10: `onOpenUrl` listener never cleaned up
- **File:** `src/main.ts:10-18`
- **Description:** `onOpenUrl()` registers a deep-link callback at module level but never stores or calls the returned unlisten function. During HMR in development, this accumulates duplicate listeners.
- **Impact:** Duplicate navigation on deep-link events during HMR.
- **Recommendation:** Store the unlisten function and call it on HMR dispose, or guard against duplicate registration.
- **Effort:** S

#### H-11: Escape key conflict between multiple overlays
- **File:** `src/composables/useCommandPalette.ts:23-26`, `src/components/ai/AskPanel.vue:38-43`, `src/components/settings/SettingsModal.vue:74-79`
- **Description:** Three separate global `keydown` handlers all listen for Escape on `window`. The command palette handler does not check if other overlays are open. Pressing Escape can close multiple overlays simultaneously.
- **Impact:** Confusing UX — pressing Escape may dismiss overlays the user didn't intend to close.
- **Recommendation:** Implement a layered overlay/modal stack where only the topmost overlay responds to Escape, or check overlay visibility before closing.
- **Effort:** M

#### H-12: Updater has placeholder URL and empty pubkey
- **File:** `src-tauri/tauri.conf.json:51-55`
- **Description:** The updater endpoint is a placeholder (`https://github.com/your-org/dalil/releases/latest/download/latest.json`) and the `pubkey` is an empty string. The updater plugin is initialised in `lib.rs:31`, so it will attempt to check this endpoint.
- **Impact:** Auto-updates do not work. Empty pubkey means signature verification is impossible — updates would either fail or be insecure.
- **Recommendation:** Configure a real endpoint and generate a keypair, or disable the updater plugin until ready.
- **Effort:** M

#### H-13: CSP is null — no Content Security Policy
- **File:** `src-tauri/tauri.conf.json:27-28`
- **Description:** `"csp": null` disables the Content Security Policy entirely. The app renders user-sourced HTML (markdown with `allowDangerousHtml: true`) and AI-generated content via `v-html`. No webview-level XSS protection exists.
- **Impact:** Amplifies the XSS surface from C-01 and stored XSS from handbook content. If any content contains malicious scripts, they execute in the Tauri webview with full app capabilities.
- **Recommendation:** Set a restrictive CSP (e.g. `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'`).
- **Effort:** M
- **See also:** Previous hunt BH-002.

#### H-14: Dead code `render-markdown.ts` has wrong config
- **File:** `scripts/lib/render-markdown.ts`
- **Description:** This file defines a standalone markdown processor that is never imported by `build-handbook.ts`. It uses the old single-theme Shiki format (`theme: 'github-light'`) and lacks `remarkResolveLinks` and `rehypeSlug`. If a future developer uses this module instead of the inline processor, they get broken rendering.
- **Impact:** Misleading dead code with incorrect configuration.
- **Recommendation:** Delete the file.
- **Effort:** S

#### H-15: Hardcoded absolute path in `dalil.config.ts`
- **File:** `dalil.config.ts:9`
- **Description:** The collection source path is hardcoded to `/Users/dannyharding/Herd/scooda-worktrees/documentation-tidy-up/project/engineering-handbook/`. This will fail on any other machine or CI.
- **Impact:** Build fails for any other developer or CI environment.
- **Recommendation:** Use an environment variable with a fallback, or a path relative to the project root.
- **Effort:** S

---

### Medium (26)

#### M-01: `mask_key` panics on multi-byte UTF-8 strings
- **File:** `src-tauri/src/settings.rs:43-44`
- **Description:** `&key[..4]` and `&key[key.len() - 4..]` perform byte-level slicing on `&str`. If an API key contains multi-byte UTF-8 characters, this panics at the byte boundary.
- **Impact:** Panics when displaying settings if a key contains non-ASCII characters. Low practical risk (API keys are typically ASCII).
- **Recommendation:** Use `key.chars().take(4)` and `key.chars().rev().take(4)` for character-safe slicing.
- **Effort:** S

#### M-02: FTS5 MATCH query not sanitised
- **File:** `src-tauri/src/commands.rs:114,139` and `src-tauri/src/ai.rs:274`
- **Description:** User search input is passed directly to FTS5 MATCH. FTS5 has its own query syntax (`NOT`, `OR`, `NEAR`, `*`, `"` quotes). Malformed expressions cause SQLite errors. In `ai.rs:274`, keywords joined with `OR` are not escaped for FTS5 special characters.
- **Impact:** Users typing special characters in search get cryptic error messages instead of results.
- **Recommendation:** Escape or quote FTS5 special characters in user input. Wrap each term in double quotes: `"term1" OR "term2"`.
- **Effort:** S
- **See also:** Previous hunt BH-005 (stale search results).

#### M-03: No timeout on `reqwest::Client` builders
- **File:** `src-tauri/src/ai.rs` — lines 38, 86, 455, 547, 627, 687
- **Description:** Six `reqwest::Client::new()` calls have no timeout. Only `is_ollama_available` (line 124) and the Ollama test connection (line 741) set timeouts. A hung API endpoint blocks the Tauri command indefinitely.
- **Impact:** UI becomes unresponsive if an API endpoint hangs (e.g. OpenAI outage).
- **Recommendation:** Add `.timeout(Duration::from_secs(30))` to all client builders. Use shorter timeouts for connection checks.
- **Effort:** S

#### M-04: Anthropic `test_provider` costs money
- **File:** `src-tauri/src/ai.rs:711-715`
- **Description:** The Anthropic connection test sends a real message (`"Hi"` with `max_tokens: 1`), unlike OpenAI which just lists models. Each test consumes API credits.
- **Impact:** Minor cost per connection test. Repeated testing adds up.
- **Recommendation:** Document this behaviour in the UI, or find a free Anthropic API endpoint for validation.
- **Effort:** S

#### M-05: `preferred_provider` deserialization silently drops invalid values
- **File:** `src-tauri/src/commands.rs:274-275`
- **Description:** `serde_json::from_value(serde_json::Value::String(p.clone())).ok()` silently drops invalid provider strings. If a stored value becomes invalid after a code change, the setting is ignored with no warning.
- **Impact:** User's preferred provider could be silently ignored.
- **Recommendation:** Log a warning when deserialization fails.
- **Effort:** S

#### M-06: `current_dir().unwrap()` in dev mode
- **File:** `src-tauri/src/db.rs:10`
- **Description:** `std::env::current_dir().unwrap()` panics if the current directory is deleted or inaccessible.
- **Impact:** Crash in dev mode with an unhelpful panic message.
- **Recommendation:** Replace with `.expect("Failed to get current directory")` or return a `Result`.
- **Effort:** S

#### M-07: `expect()` on `resource_dir` in production
- **File:** `src-tauri/src/db.rs:18-19`
- **Description:** `.expect("Failed to resolve resource directory")` panics with no recovery if the resource directory is unavailable (corrupted install, permission issue).
- **Impact:** Unrecoverable crash on startup in production.
- **Recommendation:** Return a `Result` and show a user-friendly error dialog.
- **Effort:** S
- **See also:** Previous hunt BH-003.

#### M-08: Unbounded scroll position Map
- **File:** `src/composables/useScrollMemory.ts:3`
- **Description:** `scrollPositions` is a module-level `Map<string, number>` that grows indefinitely as the user navigates. Each unique route path adds an entry.
- **Impact:** Minor memory growth over long sessions. Unlikely to be problematic with ~93 documents.
- **Recommendation:** Add a max-size eviction policy (e.g. LRU with 100 entries).
- **Effort:** S

#### M-09: `contain: strict` on main element clips overflow
- **File:** `src/layouts/AppLayout.vue:162`
- **Description:** CSS `contain: strict` on `<main>` prevents any absolutely positioned children (tooltips, popovers, dropdowns) from overflowing the main boundary.
- **Impact:** Any future tooltips or popovers rendered inside `<main>` will be clipped.
- **Recommendation:** Use `contain: content` or `contain: layout paint` instead, or ensure floating elements use a portal.
- **Effort:** S

#### M-10: `openCollection` navigates to `/` instead of first document
- **File:** `src/pages/HomePage.vue:15-19`
- **Description:** `openCollection()` sets the active collection then calls `router.push('/')`, which is the current page. The user clicks a collection card and nothing visible happens.
- **Impact:** Confusing UX — collection selection appears broken on the home page.
- **Recommendation:** Navigate to the collection's first document, or update the sidebar and scroll to the collection.
- **Effort:** S
- **See also:** Previous hunt BH-004 (shortcut related, different root cause).

#### M-11: Tag page is a stub
- **File:** `src/pages/TagPage.vue:64-71`
- **Description:** The tag page only shows a count and a message saying the backend API is not yet available. Users can click tags from sidebar and content headers but land on a dead-end page.
- **Impact:** Incomplete feature leading to dead-end navigation.
- **Recommendation:** Implement the tag query endpoint, or remove tag links until the feature is complete.
- **Effort:** M

#### M-12: Media query listener never removed
- **File:** `src/composables/useTheme.ts:19`
- **Description:** `mediaQuery.addEventListener('change', handleMediaChange)` is called at module load time but `removeEventListener` is never called.
- **Impact:** Negligible — the listener persists for the app lifetime, which is the desired behaviour.
- **Recommendation:** Add cleanup for correctness, or add a comment explaining the intentional singleton pattern.
- **Effort:** S

#### M-13: Non-meta shortcut matching is inverted
- **File:** `src/composables/useKeyboardShortcuts.ts:68`
- **Description:** When `shortcut.meta` is `false`, `metaMatch` is always `true`, so the shortcut fires even when Cmd/Ctrl IS pressed. No current shortcuts have `meta: false`, but this is a latent bug.
- **Impact:** No current impact. Future non-meta shortcuts would match incorrectly.
- **Recommendation:** Change to `const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)`.
- **Effort:** S

#### M-14: `htmlCache` keyed by slug, not content hash
- **File:** `src/components/content/DocumentView.vue:13-28`
- **Description:** The sanitised HTML cache is keyed by slug. If a document's content changes (after rebuild), the cached HTML is stale until the 30-entry LRU evicts it.
- **Impact:** Stale content display after rebuilds. Compounds H-08 and H-09.
- **Recommendation:** Include a content hash or version in the cache key, or clear the cache on app focus/navigation refresh.
- **Effort:** S

#### M-15: Link handler doesn't handle relative paths
- **File:** `src/components/content/DocumentView.vue:79-99`
- **Description:** The click handler handles `#`, `/docs/`, `/`, and `http(s)://` hrefs, but not relative links (`./sibling` or `../parent/doc`). These are swallowed by `event.preventDefault()` with no action.
- **Impact:** Relative links in document content are silently broken.
- **Recommendation:** Resolve relative links against the current document's slug and navigate via router.
- **Effort:** S
- **See also:** Previous hunt BH-007, BH-008.

#### M-16: AI panel z-index collision with toolbar
- **File:** `src/components/ai/AskPanel.vue:58-68`
- **Description:** The overlay uses `z-40`, the panel uses `z-50`, and the toolbar in `AppLayout.vue:65` also uses `z-50`. The toolbar buttons remain clickable through the AI panel overlay.
- **Impact:** Users can interact with toolbar buttons while the AI overlay is displayed.
- **Recommendation:** Increase the AI panel overlay to `z-50` and panel to `z-60`, or restructure the z-index scale.
- **Effort:** S

#### M-17: Router guards in `useScrollMemory` never unregistered
- **File:** `src/composables/useScrollMemory.ts:32-38`
- **Description:** `router.beforeEach()` and `router.afterEach()` return unregister functions that are never called. Benign since AppLayout never unmounts.
- **Impact:** Negligible.
- **Recommendation:** Store and call on unmount for correctness.
- **Effort:** S

#### M-18: Navigation tree `parentSlug` not updated during merge
- **File:** `scripts/lib/build-navigation.ts:82-97`
- **Description:** In Pass 3, when a section node is merged with a matching document, only `title` and `sortOrder` are updated — `parentSlug` and `level` are not. If the document has a different `parentSlug`, the section node retains the incorrect value from Pass 1.
- **Impact:** Could produce incorrect parent-child relationships if index documents have non-empty parentSlugs. Currently benign.
- **Recommendation:** Update `parentSlug` and `level` during the merge.
- **Effort:** S

#### M-19: Two different `toSlug()` implementations
- **File:** `scripts/lib/build-navigation.ts:140-145` vs `scripts/lib/extract-metadata.ts:36-41`
- **Description:** `extract-metadata.ts` strips numeric prefixes before slugifying. `build-navigation.ts` does not. This works today because `buildNavigation` operates on already-cleaned section names, but the inconsistency is a maintenance hazard.
- **Impact:** If section names ever contain numeric prefixes, navigation slugs and document slugs diverge.
- **Recommendation:** Extract a shared `toSlug()` utility.
- **Effort:** S

#### M-20: Heading context lost for carry-over chunks
- **File:** `scripts/lib/chunk-content.ts:162-166`
- **Description:** When a small section's content is merged into the carry-over buffer, the heading context is not preserved. The carry-over is eventually flushed with the heading of the next section rather than the content that dominates the buffer.
- **Impact:** Some RAG chunks get incorrect `headingContext`, reducing AI Q&A quality.
- **Recommendation:** Track the dominant heading for the carry-over buffer separately.
- **Effort:** M

#### M-21: WAL/SHM files not cleaned up before rebuild
- **File:** `scripts/lib/create-database.ts:5-7`
- **Description:** Only the main `.db` file is deleted before rebuild. SQLite WAL-mode sidecar files (`-wal`, `-shm`) are not cleaned up and could interfere with the new database.
- **Impact:** Potential stale data or corruption if old WAL/SHM files interfere.
- **Recommendation:** Also delete `${dbPath}-wal` and `${dbPath}-shm` before creating the new database.
- **Effort:** S

#### M-22: Root README gets odd slug
- **File:** `scripts/lib/extract-metadata.ts:68-70`
- **Description:** A root `README.md` produces slug `readme`, resulting in a URL like `engineering-handbook/readme` which is an odd path for the collection index.
- **Impact:** Cosmetic — odd URL for root documents. Filtered out of navigation by Pass 3.
- **Recommendation:** Handle root README as the collection index with an empty or `index` slug.
- **Effort:** S

#### M-23: Third-party Tauri schema URL
- **File:** `src-tauri/tauri.conf.json:2`
- **Description:** The `$schema` references a community-maintained repo (`nicoverbruggen/tauri-schema`) rather than the official Tauri 2 schema.
- **Impact:** IDE validation hints may be inaccurate.
- **Recommendation:** Use the auto-generated schema from `gen/schemas/` or the official Tauri 2 schema URL.
- **Effort:** S

#### M-24: Missing `@tauri-apps/plugin-store` JS dependency
- **File:** `src-tauri/Cargo.toml:18` vs `package.json`
- **Description:** `tauri-plugin-store` is a Rust dependency but has no matching JS plugin in `package.json`. The store is only used from Rust, so the JS binding is not strictly required.
- **Impact:** Inconsistency. Minor — no functional impact unless frontend needs direct store access.
- **Recommendation:** Either add the JS plugin for completeness, or add a comment explaining it's Rust-only.
- **Effort:** S

#### M-25: No database indexes on query columns
- **File:** `scripts/lib/create-database.ts:23-68`
- **Description:** No indexes on `documents.collection_id`, `navigation_tree.collection_id`, `chunks.document_id`, or the navigation sort columns. At 93 documents this is fine, but won't scale.
- **Impact:** Negligible now. Would cause slow queries with larger datasets.
- **Recommendation:** Add indexes when scaling beyond a few hundred documents.
- **Effort:** S

#### M-26: `chunk_embeddings` table has no PRIMARY KEY
- **File:** `scripts/lib/create-database.ts:70-73`
- **Description:** Only has `chunk_id` (FK) and `embedding` (BLOB), with no primary key or unique constraint. Duplicate rows could be inserted.
- **Impact:** Potential duplicate embeddings if the embedding pipeline runs twice without clearing.
- **Recommendation:** Add `PRIMARY KEY (chunk_id)` or a `UNIQUE` constraint.
- **Effort:** S

---

### Low (18)

#### L-01: `NavigationNode.parent_slug` is `String` not `Option<String>`
- **File:** `src-tauri/src/models.rs:18`
- **Description:** Root nodes presumably use empty string. If the DB has NULL values, `row.get()` fails.
- **Effort:** S

#### L-02: `Document` model has all non-optional String fields
- **File:** `src-tauri/src/models.rs:25-36`
- **Description:** Fields like `section`, `parent_slug`, `content_raw` are all `String`. NULLs in the DB cause runtime errors.
- **Effort:** S

#### L-03: `expect()` on Tauri `run()`
- **File:** `src-tauri/src/lib.rs:57`
- **Description:** Standard Tauri boilerplate. Panics if the app fails to start.
- **Effort:** N/A — accepted pattern.

#### L-04: Dead code: `Chunk` and `AiMessage` structs
- **File:** `src-tauri/src/models.rs:54,101`
- **Description:** `Chunk` is unused (only `ScoredChunk` is used). `AiMessage` duplicates `AiChatMessage` in `ai.rs`.
- **Effort:** S

#### L-05: `merge_key` mask detection via `contains("...")`
- **File:** `src-tauri/src/commands.rs:249`
- **Description:** Fragile detection — a key legitimately containing `...` would be treated as masked.
- **Effort:** S

#### L-06: Parent directly mutates child's exposed refs
- **File:** `src/components/settings/SettingsModal.vue:61-71`
- **Description:** Breaks one-way data flow. Parent reaches into `ProviderConfig`'s `testing` and `testResult` refs.
- **Effort:** S

#### L-07: Double state mutation for provider test
- **File:** `src/components/settings/ProviderConfig.vue:23-27`
- **Description:** Both child (`handleTest`) and parent (`handleTestProvider`) set `testing = true`. Redundant.
- **Effort:** S

#### L-08: Module-level watch in `useSearch`
- **File:** `src/composables/useSearch.ts:33-65`
- **Description:** The `watch(query, ...)` runs at module level (outside the function). Correct but unusual — could confuse maintainers.
- **Effort:** S

#### L-09: Double Escape handler for command palette
- **File:** `src/composables/useCommandPalette.ts:23-26`
- **Description:** Window-level and component-level handlers both fire on Escape. Harmless (closing an already-closed palette is a no-op) but wasteful.
- **Effort:** S

#### L-10: Deep-link URL not validated before routing
- **File:** `src/main.ts:10-18`
- **Description:** `onOpenUrl` strips `dalil://` and passes the remainder to `router.push()` without validation. Unknown routes show blank content.
- **Effort:** S

#### L-11: `useLastVisited` watcher lifecycle
- **File:** `src/composables/useLastVisited.ts:8-15`
- **Description:** Watch created outside component lifecycle. Relies on Vue auto-stop. Benign since AppLayout persists.
- **Effort:** S

#### L-12: `extractSortOrder` called on `parsed.base` (includes extension)
- **File:** `scripts/lib/extract-metadata.ts:81`
- **Description:** Regex still matches correctly since extension is at the end. Semantically imprecise.
- **Effort:** S

#### L-13: Sentence-splitting regex doesn't handle edge cases
- **File:** `scripts/lib/chunk-content.ts:19`
- **Description:** Regex `/[^.!?]+[.!?]+[\s]*/g` doesn't handle URLs with dots, abbreviations (`e.g.`), or ellipses.
- **Effort:** M

#### L-14: `extractMetadata` called 3 times per file
- **File:** `scripts/build-handbook.ts:54,92,110`
- **Description:** Pure function called redundantly. Could be memoised.
- **Effort:** S

#### L-15: Empty `references` array in tsconfig
- **File:** `tsconfig.json:27`
- **Description:** `"references": []` — harmless but unnecessary.
- **Effort:** S

#### L-16: Read-only DB behind Mutex serialises all reads
- **File:** `src-tauri/src/db.rs:23-25`
- **Description:** `Mutex<Connection>` prevents concurrent read queries. An `RwLock` would allow parallel reads.
- **Effort:** S

#### L-17: `SearchEmpty` displays user query
- **File:** `src/components/search/SearchEmpty.vue:13`
- **Description:** Safe — Vue's `{{ }}` interpolation auto-escapes. Noted for awareness only.
- **Effort:** N/A

#### L-18: Clippy lint warnings
- **File:** `src-tauri/src/ai.rs:453,540`, `src-tauri/src/lib.rs:17`
- **Description:** `manual_strip` and `needless_borrow` warnings fail `clippy -D warnings`.
- **Effort:** S
- **See also:** Previous hunt BH-010.

---

## Recommended Fix Order

### Phase 1: Security and correctness (do first)
1. **C-01** — Remove `style` from DOMPurify allowlist
2. **H-13** — Set a proper CSP in `tauri.conf.json`
3. **M-02** — Sanitise FTS5 query input
4. **M-01** — Fix `mask_key` UTF-8 slicing

### Phase 2: AI streaming robustness
5. **H-01** — Add cancellation on re-ask (clean up old listeners)
6. **H-02** — Use `Promise.all` for listener registration
7. **H-04** — Check emit results and break on failure
8. **H-05** — Propagate `ask_question` errors properly
9. **M-03** — Add timeouts to all `reqwest` clients

### Phase 3: Quick cleanup
10. **H-14** — Delete `render-markdown.ts`
11. **H-15** — Make source path configurable
12. **M-21** — Clean up WAL/SHM files before rebuild
13. **L-04** — Remove dead code structs
14. **L-18** — Fix clippy lint warnings

### Phase 4: UX fixes
15. **M-10** — Fix `openCollection` navigation
16. **M-11** — Implement tag page or remove tag links
17. **H-11** — Layered Escape key handling
18. **M-16** — Fix z-index collision
19. **M-15** — Handle relative links in documents

### Phase 5: Robustness and scaling
20. **H-08 + H-09 + M-14** — Cache invalidation strategy
21. **M-25 + M-26** — Database indexes and constraints
22. **H-12** — Configure updater or disable plugin
23. **M-07** — Graceful error on missing resource directory

---

## Cross-Reference with Previous Hunt (BH-001 to BH-010)

| Previous ID | Status in this report |
|-------------|----------------------|
| BH-001 | Covered by C-01 (XSS via AI response) |
| BH-002 | Covered by H-13 (CSP null) and C-01 |
| BH-003 | Covered by M-07 (resource_dir expect) |
| BH-004 | Related to H-11 (Escape conflicts); shortcut double-registration may be resolved |
| BH-005 | Covered by M-02 (FTS5 query sanitisation) |
| BH-006 | Not re-observed — may have been fixed |
| BH-007 | Covered by M-15 (link handler relative paths) |
| BH-008 | Covered by M-15 (link handler) |
| BH-009 | Not re-examined in detail |
| BH-010 | Covered by L-18 (clippy lint warnings) |

---

## Validation Notes

- No tests exist in the codebase (Rust or TypeScript).
- `cargo test` passes with 0 tests discovered.
- Type-checking (`vue-tsc --noEmit`) was not run during this audit.
- All findings are based on static code review; no runtime testing was performed.
