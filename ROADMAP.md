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

### [Performance] Optimise AI streaming response rendering
- **Priority:** P2 (important)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** The AI Q&A panel re-renders the entire response on every streaming character, causing visible jank and high CPU usage during long answers. Buffering chunks and using incremental DOM updates would keep the UI responsive during streaming, especially for complex markdown responses with code blocks.
- **Acceptance criteria:**
  - Streaming response rendering batched (e.g. every 50ms or per-line) rather than per-character
  - No visible jank or dropped frames during AI response streaming
  - CPU usage during streaming reduced by at least 50% compared to current behaviour
  - HTTP client reused across AI requests (not recreated per request)
  - Final rendered output identical to current behaviour

### [Feature] Add bookmark and reading progress tracking
- **Priority:** P2 (important)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-20
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
- **Status:** completed
- **Completed:** 2026-03-20
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
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** Users often need to cross-reference between handbooks — a DevOps runbook might relate to an architecture decision record, or a testing guide might complement an API reference. Surfacing related documents from other collections based on shared tags, similar content, or explicit links would help users discover relevant material they might otherwise miss.
- **Acceptance criteria:**
  - "Related" section at the bottom of each document page showing up to 5 related documents
  - Suggestions sourced from: shared tags, FTS similarity scoring, and explicit markdown links
  - Results include document title, collection name, and relevance indicator
  - Related content fetched asynchronously (does not block page render)
  - Users can dismiss irrelevant suggestions (dismissed state persisted)

### [Distribution] Add handbook source change detection with rebuild prompting
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** The handbook database is built from markdown source files via `npm run build:handbook`, but there is no mechanism to detect when source files have changed since the last build. Users editing handbook content must remember to rebuild manually — if they forget, the app serves stale content without any indication. File system watching on the configured source directories with a notification prompting rebuild would eliminate this silent staleness.
- **Acceptance criteria:**
  - File watcher monitors all collection source directories defined in dalil.config.ts
  - Toast notification appears when markdown files are added, modified, or deleted
  - Notification includes "Rebuild now" action that triggers the build pipeline
  - Build timestamp displayed in the UI (settings or footer) for reference
  - Watcher active during tauri dev mode; no watcher needed in production builds (DB is bundled)

### [UX/UI] Add document breadcrumb navigation showing collection and parent path
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** When navigating deep into a handbook collection, users lose context about where they are in the hierarchy — the sidebar highlights the current document but the content area provides no orientation. A breadcrumb trail above the document content (e.g. "DevOps Handbook > Deployment > Blue-Green Strategy") showing the collection name and parent path would help users maintain spatial awareness, especially when arriving at a page via search or a cross-collection link rather than sidebar navigation.
- **Acceptance criteria:**
  - Breadcrumb displayed above document title showing: collection name > parent path segments > current document
  - Each breadcrumb segment is clickable, navigating to that level in the sidebar
  - Breadcrumb derived from the document's slug and collection metadata (no additional database queries)
  - Breadcrumb hidden on the home page and collection root pages (where it would be redundant)
  - Styled subtly (small text, muted colour) to avoid competing with the document title

### [Feature] Add multi-collection search scope selector for targeted queries
- **Priority:** P3 (nice-to-have)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** When multiple handbook collections are loaded (e.g. architecture guides, API references, runbooks), the search bar searches across all of them simultaneously. For users who know which collection contains the information they need, this produces noisy results from irrelevant collections. A scope selector (dropdown or toggle pills) in the search interface that lets users restrict queries to one or more specific collections would improve search precision and reduce result scanning time, especially for installations with many large handbooks.
- **Acceptance criteria:**
  - Search scope selector available in the search UI (dropdown or toggle pills showing loaded collections)
  - Default scope: "All collections" (current behaviour preserved)
  - Selected scope persisted for the session (reset on app restart)
  - FTS query filtered by collection ID when a specific scope is selected
  - Search result count updates to reflect scoped results
  - Scope selection does not add perceptible latency to search queries

### [Quality] Add FTS index consistency verification on database load
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-21
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** The FTS5 search index is populated during the build pipeline and lives alongside the documents table in dalil.db. If a build is interrupted, the database is modified outside the app, or a migration introduces inconsistency, the FTS index can become desynchronised from the documents table — causing search to return stale or missing results with no indication to the user. Verifying FTS consistency on database load (row count match, spot-check sampling) and offering a one-click rebuild when issues are detected would prevent silent search failures.
- **Acceptance criteria:**
  - On database load, verify FTS row count matches documents table row count
  - Spot-check 10 random documents to confirm FTS content matches document content
  - If inconsistency detected, display a warning banner with "Rebuild search index" action
  - Rebuild action repopulates the FTS table from the documents table (not a full handbook rebuild)
  - Verification completes within 200ms for databases with 500+ documents
  - Verification result logged for debugging (not shown to user unless inconsistency found)

### [UX/UI] Add collection-level reading progress indicators
- **Priority:** P3 (nice-to-have)
- **Size:** S (< 1hr)
- **Added:** 2026-03-21
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** Engineers working through handbook collections (onboarding material, architecture guides, runbook sets) have no sense of how much of a collection they have covered. Tracking which documents have been viewed per collection and displaying a simple progress indicator (e.g. "12 of 34 pages read") in the sidebar collection list would help users gauge their coverage and identify unread material, especially valuable during structured onboarding programmes.
- **Acceptance criteria:**
  - Per-document "viewed" flag set when a document is opened (scroll position > 0 for at least 5 seconds)
  - Collection sidebar items display progress badge (e.g. "12/34" or percentage bar)
  - Unread documents visually distinguishable in the navigation tree (subtle indicator, not disruptive)
  - Progress data persisted in the SQLite database (not localStorage)
  - "Mark all as read" and "Reset progress" actions available per collection
  - Progress tracking does not affect search ranking or document ordering

### [UX/UI] Add code block copy-to-clipboard button
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** Engineering handbooks are dense with code snippets, CLI commands, configuration examples, and API payloads that developers need to copy into their terminals or editors. The current workflow requires manually selecting text within a code block — fiddly on long blocks and error-prone when lines wrap. A "Copy" button positioned at the top-right corner of each code block (matching the convention established by GitHub, MDN, and Docusaurus) would make the most common interaction with handbook content a single click. The Shiki syntax highlighting pipeline already wraps code blocks in identifiable containers, making button injection straightforward.
- **Acceptance criteria:**
  - Copy button appears on hover at the top-right corner of every `<pre><code>` block
  - Click copies the raw code content (without line numbers or syntax highlighting markup) to the system clipboard
  - Brief visual confirmation on copy (button text changes to "Copied" or checkmark icon for 1.5 seconds)
  - Button does not interfere with text selection within the code block
  - Works correctly for both inline code fences and multi-line code blocks
  - Styled subtly to avoid visual clutter when not hovered

### [Feature] Add recently viewed documents list for quick navigation
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** Engineers typically consult the same handful of handbook pages daily — the deployment runbook, the API authentication guide, the database naming conventions. Each visit currently requires navigating the sidebar tree or running a search. A "Recently Viewed" section in the sidebar (showing the last 10-15 documents visited, ordered by most recent) would provide instant access to frequently referenced material without any navigation effort, matching the pattern established by VS Code's recent files and browser history.
- **Acceptance criteria:**
  - "Recently Viewed" section visible in the sidebar below the collection tree (collapsible)
  - Shows last 15 documents visited, ordered by most recent first
  - Each entry shows document title and collection name
  - Click navigates directly to the document
  - Duplicates collapsed (re-visiting moves to top, doesn't create a second entry)
  - Recent list persisted in the SQLite database (not localStorage) across sessions
  - "Clear recents" action available

### [UX/UI] Add keyboard shortcut help overlay
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-20
- **Status:** completed
- **Completed:** 2026-03-20
- **Description:** Dalil has extensive keyboard navigation implemented through composables (useKeyboardNavigation, useKeyboard) supporting document traversal, search focus, sidebar toggle, and theme switching — but these shortcuts are completely undiscoverable. There is no visual documentation within the app showing which keys do what. A Cmd+/ overlay listing all available shortcuts (grouped by context: navigation, search, content) would make the keyboard-driven workflow accessible to new users and serve as a reference for power users. Every other app in the portfolio has keyboard shortcut documentation planned or implemented; Dalil — which has the most comprehensive keyboard support — lacks it.
- **Acceptance criteria:**
  - Cmd+/ toggles a modal overlay listing all available keyboard shortcuts
  - Shortcuts grouped by context: navigation (sidebar, documents), search, content (scroll, TOC), app (theme, settings)
  - Each shortcut shows the key combination and a brief description
  - Overlay dismissible via Escape, Cmd+/, or clicking outside
  - Overlay styled consistently with the existing Scooda design (modal pattern, correct z-index)
  - Shortcuts list generated from the actual composable registrations (not a hardcoded separate list)

### [Feature] AI conversation history persistence across sessions
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-24
- **Description:** AI Q&A conversations are lost when navigating away from a document or closing the app. Persisting conversation threads per document in the user state SQLite database would allow users to return to previous Q&A sessions, building a knowledge trail alongside the handbook content. Each document accumulates its own conversation history, accessible when the document is re-opened.
- **Acceptance criteria:**
  - AI conversation messages (user questions + assistant responses) persisted in SQLite per project + document
  - Conversation history loaded automatically when opening a document that has prior Q&A
  - "New thread" action starts a fresh conversation while preserving history
  - "Clear history" removes all persisted conversations for the current document
  - Source references stored alongside assistant messages for later review

### [Feature] Document backlink navigation
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-24
- **Description:** Internal links between handbook documents are one-directional — you can follow a link from document A to document B, but document B has no awareness that A links to it. Building a reverse index during the build pipeline and displaying "Referenced by" links on each document page would surface these implicit relationships, helping users discover related content they might otherwise miss.
- **Acceptance criteria:**
  - Build pipeline collects resolved internal links and stores reverse mappings in a document_backlinks table
  - "Referenced by" section displayed below related documents on DocPage
  - Each backlink shows source document title, collection name, and link text
  - Backlinks loaded asynchronously (do not block page render)
  - Graceful handling when backlinks table does not exist (pre-rebuild databases)

### [Quality] Broken internal link detection
- **Priority:** P2 (important)
- **Size:** S (< 1hr)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-24
- **Description:** The build pipeline already detects broken internal links and logs them to the console, but this information is ephemeral — it vanishes after the build completes. Storing broken links in the database and surfacing them as a warning banner on the home page would make link health visible to all users, not just whoever ran the build. This complements the existing FTS health banner pattern.
- **Acceptance criteria:**
  - Build pipeline stores broken links in a broken_links database table (source slug, link text, target URL)
  - Amber warning banner on HomePage shows broken link count when any exist
  - Banner expandable to show full list with source document links and target URLs
  - Banner follows existing FtsHealthBanner design pattern
  - Graceful handling when broken_links table does not exist

### [Innovation] Add AI-powered page summarisation for long handbook documents
- **Priority:** P3 (nice-to-have)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Status:** completed
- **Completed:** 2026-03-28
- **Description:** Many engineering handbook pages are dense multi-thousand-word references that take significant time to parse. Leveraging the existing AI infrastructure (RAG pipeline, provider configuration) to generate a concise summary at the top of long documents would help engineers quickly determine if a page contains what they need before committing to a full read. This is especially valuable for onboarding engineers encountering unfamiliar handbooks.
- **Acceptance criteria:**
  - "Summarise" button or auto-summary section available on documents exceeding a configurable length threshold (default: 1500 words)
  - Summary generated using the configured AI provider and displayed in a collapsible panel at the top of the document
  - Summary cached in the database to avoid repeated API calls for the same document version
  - Cache invalidated when document content hash changes (handbook rebuild)
  - Summary generation is on-demand (not automatic) to respect API usage and user preference

## Pending

_No pending items outside the Shared Component Library section._

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

## Archived

### [Performance] Parallelise markdown build pipeline
- **Priority:** P3 (nice-to-have)
- **Size:** M (1-3hrs)
- **Added:** 2026-03-19
- **Archived:** 2026-03-20
- **Reason:** Developer-facing build optimisation with no user-visible impact. Current build times are acceptable for the handbook sizes in use. The content-hash skip optimisation (part of this item's criteria) would deliver the most value and could be extracted as a standalone item if build times become problematic. Revisit when handbook collections exceed 500 documents.
