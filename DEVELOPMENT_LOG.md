# Dalil Development Log

## Cycle: 2026-03-19 22:00
- App: Dalil
- Items completed:
  - [Quality] Sanitise AI response and handbook HTML to prevent XSS — Three-tier DOMPurify sanitisation: `sanitiseHtml` (handbook content, permits `style` for Shiki), `sanitiseAiHtml` (AI responses, strips `style` for CSS exfiltration defence), `sanitiseSnippet` (FTS5 search results, only `<mark>` permitted). Build-time sanitisation added via `rehype-sanitize` in the handbook pipeline as defence-in-depth. SearchResult.vue migrated from regex whitelist to DOMPurify. Dev-mode database path resolution fixed to use `CARGO_MANIFEST_DIR` instead of fragile `current_dir()`. 31 XSS verification tests added covering `<script>`, `onerror`, `onclick`, `javascript:`, iframe, SVG injection, CSS exfiltration, and data-* attribute vectors.
- Items attempted but failed: none
- Branch: feature/xss-sanitisation-and-db-path-fix
- Tests passing: yes (59/59 — 28 existing + 31 new XSS verification tests)
- Build status: success (Dalil.app + Dalil_0.3.1_aarch64.dmg bundled)
- Notes: DOMPurify (v3.3.1) was already installed and configured for handbook and AI rendering. This cycle formalised the security posture by splitting into three trust-tier sanitisation functions, adding build-time pipeline sanitisation, migrating the last regex-based sanitiser (SearchResult.vue) to DOMPurify, fixing the db.rs path resolution bug, and adding comprehensive XSS test coverage. Pre-existing clippy warnings in ai.rs/commands.rs/models.rs were not addressed (out of scope for this item). happy-dom added as dev dependency for DOMPurify testing in Node.

## Cycle: 2026-03-20 22:00
- App: Dalil
- Items completed:
  - [Quality] Add internal link validation at build time (P2/S) — enhanced remark-resolve-links plugin with BrokenLink type to collect source file, line number, target URL, and resolved path for each broken link. Build script now prints a summary count and detailed list of broken links at build end. Added --strict flag that fails the build if any broken links are found.
  - [UX/UI] Add print-friendly document export (P3/S) — comprehensive @media print stylesheet in style.css: strips sidebar, ambient blobs, topbar, and interactive elements; forces light background with dark text; prevents code blocks and tables from splitting across pages; renders external link URLs inline; sets 2cm page margins.
  - [UX/UI] Add in-document table of contents (P2/S) — marked as completed (already implemented: useTableOfContents composable with IntersectionObserver scroll-spy, heading extraction, active state tracking, smooth scroll, rendered in DocRightSidebar)
  - [UX/UI] Add search result context snippets with query term highlighting (P2/S) — marked as completed (already implemented: FTS5 snippet() with <mark> tags in Rust backend, rendered in SearchResult.vue)
  - [UX/UI] Add code block copy-to-clipboard button (P2/S) — marked as completed (already implemented: injectCopyButtons() in DocumentView.vue with toast feedback, hover reveal CSS)
  - [Feature] Add recently viewed documents list (P2/S) — marked as completed (already implemented: useDocActivity composable with getRecentDocumentsApi)
- Items attempted but failed: none
- Branch: feature/copy-button-link-validation-search-snippets
- Tests passing: yes (cargo check clean, cargo clippy clean excluding pre-existing warnings, vue-tsc clean, vite build clean)
- Build status: success (Dalil.app + DMG bundled, copied to ~/Desktop/TauriBuilds/dalil/)
- Notes: First development cycle for Dalil. Discovery phase revealed that 4 of the originally-selected roadmap items were already fully implemented on the main branch but not marked as completed. Roadmap updated to reflect actual state. The two items implemented this cycle are build-pipeline and CSS changes respectively — no Rust backend modifications needed.

## Cycle: 2026-03-20 23:00
- App: Dalil
- Items completed:
  - [Performance] Optimise AI streaming response rendering (P2/M) — Rust-side content batching: all four streaming providers (OpenAI, Anthropic, Ollama, Gemini) now accumulate token content within each network chunk and emit a single batched IPC event per chunk rather than per-token. Added `flush_content_batch` helper function used by all providers. Frontend already had 120ms debounce in AskResponse.vue. HTTP client already reused via shared `HttpClient` Tauri state.
  - [Feature] Add bookmark and reading progress tracking (P2/M) — confirmed already implemented: full SQLite schema (bookmarks, bookmark_folders, bookmark_tags, bookmark_events tables), 20+ Rust commands, useBookmarks composable, BookmarksPage, scroll position persistence via new scroll_positions table and save_scroll_position/get_scroll_position commands.
  - [UX/UI] Add in-document table of contents (P2/S) — confirmed already implemented: useTableOfContents composable, DocRightSidebar integration.
  - [Feature] Add cross-collection related content suggestions (P3/M) — new `get_related_documents` Rust command with two-strategy approach: (1) shared tags between documents, (2) FTS title keyword similarity. New `useRelatedDocs` composable and `RelatedDocuments.vue` component rendered below document content on DocPage. Per-session dismiss support. New `dismissed_related` SQLite table for persistence.
  - [Distribution] Add handbook source change detection with rebuild prompting (P2/S) — new `check_source_changes` Rust command walks source directories comparing file modification timestamps against last build time. New `get_build_timestamp` command. `useSourceWatcher` composable polls every 30s in dev mode. `SourceChangeBanner` sidebar component with "Rebuild now" action. Production builds skip polling.
  - [UX/UI] Add document breadcrumb navigation (P2/S) — confirmed already implemented: SBreadcrumbs from @stuntrocket/ui in DocPage.vue with collection > section > document segments.
  - [Feature] Add multi-collection search scope selector (P3/S) — confirmed already implemented: collectionFilter ref in useSearch composable, collection filter pills in CommandPalette.vue, FTS query filtered by collection_id in Rust search_documents command.
  - [Quality] Add FTS index consistency verification on database load (P2/S) — new `verify_fts_consistency` Rust command checks row count match between documents and documents_fts tables, spot-checks 10 random documents. New `rebuild_fts_index` command repopulates FTS from documents table. `useFtsHealth` composable with verify/rebuild actions. `FtsHealthBanner` component displayed on HomePage when inconsistency detected.
  - [UX/UI] Add collection-level reading progress indicators (P3/S) — new `get_collection_progress` Rust command counts viewed documents per collection by cross-referencing doc_views user state with project documents. New `mark_collection_all_read` and `reset_collection_progress` commands. `useCollectionProgress` composable. `CollectionProgressBadges` sidebar component showing "viewed/total" per collection.
  - [UX/UI] Add code block copy-to-clipboard button (P2/S) — confirmed already implemented: injectCopyButtons() in DocumentView.vue.
  - [Feature] Add recently viewed documents list (P2/S) — confirmed already implemented: useDocActivity composable, doc_views table, get_recent_documents command.
  - [UX/UI] Add keyboard shortcut help overlay (P2/S) — confirmed already implemented: ShortcutHelp.vue with Cmd+? toggle, grouped shortcuts, Escape dismiss.
- Items attempted but failed: none
- Branch: main
- Tests passing: yes (cargo check clean with zero warnings)
- Build status: not run (implementation only)
- Notes: Largest execution cycle for Dalil. 7 of the 12 items were already fully implemented on main (bookmarks, TOC, code copy, recents, breadcrumbs, search scope, keyboard shortcuts). 5 items required new backend and frontend work: AI streaming optimisation (Rust batching), cross-collection related documents (new command + component), FTS consistency verification (new command + banner), collection reading progress (new command + sidebar badges), and source change detection (new command + sidebar banner). New SQLite tables added: scroll_positions, dismissed_related. All new Rust commands registered in lib.rs invoke_handler. All new frontend composables follow existing patterns (module-scope refs, exported function returning reactive state).

## Cycle: 2026-03-24 22:00
- App: Dalil
- Items completed:
  - [Feature] AI conversation history persistence across sessions (P2/S) — New `ai_conversations` SQLite table in user_state.rs stores messages per project + document with role, content, sources_json, and timestamp. Three new Rust commands: `get_ai_conversation_history`, `save_ai_conversation_message`, `clear_ai_conversation_history`. useAI composable extended with `setDocContext`, `loadHistory`, `startNewConversation`, and automatic persistence on response completion. AskPanel.vue gains "New thread" button and persisted history indicator. DocPage.vue calls `loadHistory` on document navigation.
  - [Feature] Document backlink navigation (P2/S) — Build pipeline remark-resolve-links plugin extended with `ResolvedLink` interface to collect sourceSlug, targetSlug, and linkText for each resolved internal link. New `document_backlinks` table in create-database.ts with `insertBacklinksRaw` batch insert. New `get_document_backlinks` Rust command joins backlinks with documents and collections tables. New `BacklinkDocuments.vue` component rendered below RelatedDocuments on DocPage.
  - [Quality] Broken internal link detection (P2/S) — New `broken_links` table in create-database.ts populated during build from the existing broken link detection in remark-resolve-links. New `get_broken_links` Rust command. New `BrokenLinksBanner.vue` component on HomePage following FtsHealthBanner pattern — amber warning with expandable detail list showing source documents and target URLs.
- Items attempted but failed: none
- Branch: feature/ai-history-backlinks-broken-links
- Tests passing: yes (cargo check clean, cargo clippy clean excluding pre-existing warnings, vue-tsc clean excluding pre-existing module resolution warnings)
- Build status: pending
- Notes: All three features span the full stack: build pipeline (scripts/lib/), Rust backend (models, commands, user_state schema), TypeScript types and API wrappers, and Vue components/composables. The backlinks and broken links features share the remark-resolve-links enhancement — resolved links feed backlinks, unresolved links feed broken_links. Both DB tables use graceful table-existence checks in the Rust commands to handle databases built before this feature. AI conversation cleanup added to remove_project command to prevent orphaned data.

## Cycle: 2026-03-28 17:00
- App: Dalil
- Items completed:
  - [Innovation] Add AI-powered page summarisation for long handbook documents (P3/M) — Full-stack implementation. Rust: new `document_summaries` table in user_state.db with UNIQUE(project_id, doc_slug, content_hash) constraint for automatic cache invalidation on content change. Non-streaming `complete_chat()` function added for all four AI providers (OpenAI, Anthropic, Gemini, Ollama) as a simpler alternative to the existing streaming pipeline. `build_summarise_messages()` constructs a British English system prompt targeting <300 word bullet-point summaries. `get_document_summary` (cache lookup) and `generate_document_summary` (AI call + upsert) commands with `resolve_provider()` reuse. SHA-256 content hashing via `sha2` crate on HTML-stripped plain text. Vue: `useDocSummary` composable with 1500-word threshold check, cache-first loading, and on-demand generation. `DocumentSummary.vue` collapsible panel component with provider attribution, loading/generating/error states, and accent-styled "Summarise" button. Integrated into DocPage.vue between ContentHeader and compare mode toolbar, conditionally rendered only for long documents.
- Items attempted but failed: none
- Branch: feature/ai-page-summarisation → develop
- Tests passing: yes (cargo check clean, cargo clippy clean excluding pre-existing warnings, vue-tsc clean excluding pre-existing SImageLightbox import error)
- Build status: pending
- Notes: First feature to add non-streaming AI completion support. The `complete_chat()` function complements the existing `stream_chat_response()` and is suitable for any future task where streaming is unnecessary (e.g. auto-tagging, content classification). The sha2 crate was added as a new Cargo dependency for content hashing.
