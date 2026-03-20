# Dalil Roadmap

Desktop knowledge app for browsing and searching engineering handbooks with optional AI-powered Q&A.

## Completed

### [Quality] Sanitise AI response and handbook HTML to prevent XSS
- **Priority:** P1 (critical)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-19
- **Description:** The February 2026 security audit identified XSS vulnerabilities in both AI response rendering and handbook HTML injection. AI responses rendered via `v-html` and handbook content injected without sanitisation allow arbitrary script execution. This must be resolved before any wider distribution of the app.
- **Acceptance criteria:**
  - All AI response HTML passed through DOMPurify (or equivalent) before rendering
  - Handbook HTML sanitised at build time and at render time as defence-in-depth
  - No `v-html` usage without prior sanitisation in the entire frontend
  - Verified with test payloads containing `<script>`, `onerror`, and `javascript:` vectors
  - Release database path resolution bug also fixed (audit item)

## Pending

### [Performance] Optimise AI streaming response rendering
- **Priority:** P2 (important)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** The AI Q&A panel re-renders the entire response on every streaming character, causing visible jank and high CPU usage during long answers. Buffering chunks and using incremental DOM updates would keep the UI responsive during streaming, especially for complex markdown responses with code blocks.
- **Acceptance criteria:**
  - Streaming response rendering batched (e.g. every 50ms or per-line) rather than per-character
  - No visible jank or dropped frames during AI response streaming
  - CPU usage during streaming reduced by at least 50% compared to current behaviour
  - HTTP client reused across AI requests (not recreated per request)
  - Final rendered output identical to current behaviour

### [Performance] Parallelise markdown build pipeline
- **Priority:** P3 (nice-to-have)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** The handbook build step processes markdown files sequentially and loads all 343 Shiki languages despite only using 7. Build times could be significantly reduced by parallelising file processing, loading only required languages, and batching database inserts into a single transaction (currently 88 separate transactions).
- **Acceptance criteria:**
  - Markdown files processed in parallel (worker pool or Promise.all with concurrency limit)
  - Shiki bundler configured to include only languages actually used in handbooks
  - All database inserts batched into a single transaction per build
  - Content-hash-based skip: unchanged files not reprocessed on rebuild
  - Build time reduced by at least 40% for a typical handbook set

### [Feature] Add bookmark and reading progress tracking
- **Priority:** P2 (important)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** Engineering handbooks are dense reference material that users revisit over multiple sessions. Without bookmarks or reading progress, users must manually navigate back to where they left off each time. Saving scroll position per document and letting users bookmark important sections would significantly improve the reference workflow for engineers using dalil as their daily handbook tool.
- **Acceptance criteria:**
  - Reading position (scroll offset) saved automatically per document and restored on return
  - Users can bookmark any document with an optional note
  - Bookmarks accessible from a dedicated sidebar section or keyboard shortcut
  - Bookmark count badge visible in the sidebar navigation
  - Bookmarks and reading positions persisted in the SQLite database (not localStorage)

### [UX/UI] Add in-document table of contents for long pages
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** Many handbook pages contain dozens of sections with deep heading hierarchies. Without a table of contents, users must scroll through the entire page to find a specific section. A sticky, auto-generated TOC derived from the heading structure would provide quick in-page navigation, especially valuable for long reference pages and API documentation.
- **Acceptance criteria:**
  - TOC auto-generated from h2/h3/h4 headings in the current document
  - TOC displayed as a sticky sidebar panel or floating overlay (collapsible)
  - Active section highlighted as user scrolls (scroll-spy behaviour)
  - Clicking a TOC entry smooth-scrolls to the corresponding heading
  - TOC hidden automatically for short documents (fewer than 3 headings)

### [Feature] Add cross-collection related content suggestions
- **Priority:** P3 (nice-to-have)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** Users often need to cross-reference between handbooks — a DevOps runbook might relate to an architecture decision record, or a testing guide might complement an API reference. Surfacing related documents from other collections based on shared tags, similar content, or explicit links would help users discover relevant material they might otherwise miss.
- **Acceptance criteria:**
  - "Related" section at the bottom of each document page showing up to 5 related documents
  - Suggestions sourced from: shared tags, FTS similarity scoring, and explicit markdown links
  - Results include document title, collection name, and relevance indicator
  - Related content fetched asynchronously (does not block page render)
  - Users can dismiss irrelevant suggestions (dismissed state persisted)

### [Innovation] Add AI-powered page summarisation for long handbook documents
- **Priority:** P3 (nice-to-have)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** Many engineering handbook pages are dense multi-thousand-word references that take significant time to parse. Leveraging the existing AI infrastructure (RAG pipeline, provider configuration) to generate a concise summary at the top of long documents would help engineers quickly determine if a page contains what they need before committing to a full read. This is especially valuable for onboarding engineers encountering unfamiliar handbooks.
- **Acceptance criteria:**
  - "Summarise" button or auto-summary section available on documents exceeding a configurable length threshold (default: 1500 words)
  - Summary generated using the configured AI provider and displayed in a collapsible panel at the top of the document
  - Summary cached in the database to avoid repeated API calls for the same document version
  - Cache invalidated when document content hash changes (handbook rebuild)
  - Summary generation is on-demand (not automatic) to respect API usage and user preference

### [Distribution] Add handbook source change detection with rebuild prompting
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** pending
- **Description:** The handbook database is built from markdown source files via `npm run build:handbook`, but there is no mechanism to detect when source files have changed since the last build. Users editing handbook content must remember to rebuild manually — if they forget, the app serves stale content without any indication. File system watching on the configured source directories with a notification prompting rebuild would eliminate this silent staleness.
- **Acceptance criteria:**
  - File watcher monitors all collection source directories defined in dalil.config.ts
  - Toast notification appears when markdown files are added, modified, or deleted
  - Notification includes "Rebuild now" action that triggers the build pipeline
  - Build timestamp displayed in the UI (settings or footer) for reference
  - Watcher active during tauri dev mode; no watcher needed in production builds (DB is bundled)

## Shared Component Library

Dalil is the reference implementation of the Scooda design system. These items extract its UI components into the @stuntrocket/ui shared package so all Tauri applications can achieve visual uniformity.

### [Foundation] Extract core UI components into @stuntrocket/ui shared package
- **Priority:** P1 (critical)
- **Size:** XL (8hrs+)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** Dalil contains the canonical implementation of the Scooda design system. Extract all reusable UI components into the @stuntrocket/ui package hosted on the local Verdaccio registry. This includes: design tokens (tokens.css), typography and font configuration, buttons, form controls (input, select, textarea, search), cards (content header, sidebar, list, collection, nested), badges/tags/pills, toasts, modals (settings, command palette), slide-over panel, sidebar layout, topbar, ambient background blobs, skeleton loaders, and scrollbar styling. Components should be Vue 3 + Tailwind CSS v4, with a CSS-only layer for apps that may not use Vue.
- **Acceptance criteria:**
  - @stuntrocket/ui package created with proper package.json, build pipeline, and TypeScript support
  - tokens.css exported as the foundational design token layer
  - All UI primitives extracted with consistent API (props, slots, emits)
  - Components categorised: layout (Topbar, Sidebar, PageLayout), controls (Button, Input, Select, Textarea), display (Card, Badge, Tag, Pill, Toast), overlay (Modal, CommandPalette, SlideOver), feedback (Skeleton, Spinner, EmptyState)
  - CSS-only layer available for non-Vue consumers (class-based API matching .ui-* pattern)
  - Ambient blob component with correct colours, sizes, and animation
  - Custom scrollbar CSS exported as a standalone utility
  - Dark mode support built into every component
  - Accessibility built in: focus rings, ARIA attributes, reduced motion support
  - Component documentation (props, slots, variants, usage examples) included
  - Package published to local Verdaccio registry at version 0.1.0

### [Foundation] Refactor Dalil to consume @stuntrocket/ui instead of local components
- **Priority:** P1 (critical)
- **Size:** L (3-8hrs)
- **Added:** 2026-03-19
- **Status:** pending
- **Description:** After extracting components to @stuntrocket/ui, replace all local component definitions in Dalil with imports from the shared package. This validates that the extraction is complete and that the shared components work correctly in their origin app. Dalil becomes both the design reference and the first consumer of the shared library, ensuring the package is battle-tested before other apps adopt it.
- **Acceptance criteria:**
  - @stuntrocket/ui installed from Verdaccio and used throughout Dalil
  - All previously-local components now imported from @stuntrocket/ui
  - No local duplicates of components that exist in @stuntrocket/ui
  - Visual rendering pixel-identical to pre-extraction state (regression check)
  - All dark mode, accessibility, and animation behaviours preserved
  - Build succeeds with @stuntrocket/ui as the sole UI component source
  - No increase in bundle size beyond 5% (shared package should tree-shake well)
  - Dalil's app-specific components (handbook viewer, AI panel, search) remain local — only generic UI primitives come from the shared package
