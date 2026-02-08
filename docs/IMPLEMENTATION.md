# dalil — Implementation Plan

## Context

The engineering team needs a beautiful, fast desktop app to access their engineering handbook (94 markdown documents across 10 sections). Currently these live as flat files in a repo — hard to search, navigate, and discover. The app should make finding information effortless and enjoyable, with optional AI-powered Q&A for developers who provide their own API keys. The content will grow over time and additional documentation may be onboarded.

**Source content:** Engineering handbook markdown files (94 documents, ~7,500 lines)
**Project name:** dalil (Arabic for "guide")
**Design reference:** Things (Mac app) — paper-like surfaces, micro-animations, polished stability

---

## Design Language

Inspired by **Things** for Mac. The app should feel like a beautifully crafted physical object — stable, reliable, trustworthy.

### Core principles
- **Paper-like surface** — warm off-white backgrounds (`#FAFAF8` light / `#1C1C1E` dark), not stark white. Subtle depth through layered shadows, not borders
- **Generous whitespace** — content breathes. No visual clutter. Minimal chrome
- **Micro-animations** — everything eases in/out with subtle spring physics. Sidebar items slide, content cross-fades, modals scale up softly. Movements feel physically grounded, not flashy
- **Depth via shadows** — soft, multi-layered box shadows create hierarchy between sidebar, content, and overlays. Minimal use of borders
- **Muted palette** — warm greys, a single restrained accent colour (blue). Nothing screams. Tags and badges use soft, desaturated tones
- **Deliberate transitions** — 200-300ms easing, not instant. Feels like turning a page, not switching a light

### Typography
- System fonts: `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif`
- Code: `'SF Mono', 'Fira Code', ui-monospace, monospace`
- Body: 16px, line-height 1.6, max-width `max-w-3xl` (~65ch measure)
- Headings: tight letter-spacing, medium weight (not bold-heavy)

### Colour tokens (light)
- Surface: `#FAFAF8` (warm paper white)
- Surface secondary: `#F5F5F0`
- Sidebar: `#F0F0EB` with vibrancy
- Text primary: `#1D1D1F`
- Text secondary: `#86868B`
- Border: `#E8E8E3` (barely visible)
- Accent: `#3478F6` (Things-style blue)

### Colour tokens (dark)
- Surface: `#1C1C1E`
- Surface secondary: `#2C2C2E`
- Sidebar: `#1C1C1E` with vibrancy
- Text primary: `#F5F5F7`
- Text secondary: `#98989D`
- Border: `#38383A`
- Accent: `#5E9CFF`

---

## Architecture

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust backend, native macOS window) |
| Frontend | Vue 3 + TypeScript |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` |
| Content store | SQLite with FTS5 + sqlite-vec for embeddings |
| Markdown rendering | unified/remark/rehype + Shiki (build-time) |
| Search | FTS5 full-text search + vector similarity for AI |
| AI Q&A | OpenAI + Anthropic + Ollama (user-provided keys, optional) |
| Updates | Tauri auto-updater plugin |
| Content config | `dalil.config.ts` — build-time collection definitions |

### Multi-collection content model

The app supports **multiple content collections**, each sourced from a different directory. Collections are defined in a build-time config file and can be added without code changes.

**Example `dalil.config.ts`:**
```typescript
import { defineConfig } from './scripts/lib/config'

export default defineConfig({
  collections: [
    {
      id: 'engineering-handbook',
      name: 'Engineering Handbook',
      icon: 'code',           // icon identifier for sidebar
      source: '/path/to/engineering-handbook/',
      description: 'Development standards, architecture, and best practices',
    },
    {
      id: 'employee-handbook',
      name: 'Employee Handbook',
      icon: 'users',
      source: '/path/to/employee-handbook/',
      description: 'Company policies, benefits, and procedures',
    },
    {
      id: 'client-roster',
      name: 'Client Roster',
      icon: 'briefcase',
      source: '/path/to/client-roster/',
      description: 'Client information and project details',
    },
  ],
})
```

Each collection is independently ingested, has its own navigation tree, and appears as a top-level group in the sidebar. Search can be scoped to a single collection or run globally.

### Content pipeline flow

```bash
dalil.config.ts (collection definitions)
    ↓ scripts/build-handbook.ts
    ↓ for each collection:
    ├─ gray-matter → extract frontmatter tags
    ├─ unified/remark/rehype → HTML with Shiki syntax highlighting
    ├─ custom remark plugin → resolve internal .md links to app slugs
    ├─ chunk documents → 500-token overlapping chunks for RAG
    ├─ OpenAI embedding API → vector embeddings per chunk (if key available)
    └─ better-sqlite3 → write dalil.db
    ↓
dalil.db (FTS5 + sqlite-vec, all collections in one database)
    ↓ bundled into Tauri app resources
    ↓
Rust backend (rusqlite + Tauri commands)
    ↓
Vue frontend (collection switcher + per-collection navigation)
```

---

## Phase 1: Project Scaffolding

- [ ] Complete

**Goal:** Tauri 2 + Vue 3 window opens with dev tooling working.

**Create:**
```bash
package.json
tsconfig.json
tsconfig.node.json
vite.config.ts
index.html
.gitignore
src/
  main.ts                      # Vue bootstrap
  App.vue                      # Empty shell
  style.css                    # Tailwind v4 imports, system fonts, base styles
  vite-env.d.ts
src-tauri/
  Cargo.toml                   # tauri, rusqlite (bundled + fts5), serde, serde_json
  tauri.conf.json              # Window: 1200x800, min 900x600, titleBarStyle Overlay, hiddenTitle, transparent
  capabilities/default.json    # Permissions for commands
  src/main.rs                  # Tauri entry
  src/lib.rs                   # Module declarations
```

**Key config:**
- Window: `titleBarStyle: "Overlay"`, `hiddenTitle: true`, `transparent: true`
- Default size 1200x800, min 900x600
- `beforeDevCommand`/`beforeBuildCommand` wired to build pipeline
- System font stack: `-apple-system, BlinkMacSystemFont, 'Inter', sans-serif`

**Verify:** `npm run tauri dev` opens a native macOS window with transparent titlebar and traffic lights visible.

---

## Phase 2: Build Pipeline — Markdown to SQLite

- [ ] Complete

**Goal:** Node.js script reads all handbook files, produces a populated `handbook.db`.

**Create:**
```bash
scripts/
  build-handbook.ts            # Main entry — orchestrates the pipeline
  lib/
    parse-frontmatter.ts       # gray-matter wrapper; handles files with no frontmatter
    render-markdown.ts         # unified pipeline: remark-parse → remark-gfm → remark-rehype → rehype-shiki → rehype-stringify
    remark-resolve-links.ts    # Custom remark plugin: ../path.md → /docs/slug
    build-navigation.ts        # Directory structure → navigation tree
    create-database.ts         # Schema creation, inserts, FTS5 indexing
    extract-metadata.ts        # Title from H1, slug from path, sort_order from prefix
    chunk-content.ts           # Split documents into ~500-token overlapping chunks for RAG
tsconfig.scripts.json          # Node-targeted TypeScript config for build scripts
```

**Database schema:**
```sql
-- Core tables
documents (id, slug UNIQUE, title, section, sort_order, parent_slug, content_html, content_raw, path)
tags (id, tag UNIQUE)
document_tags (document_id, tag_id)
navigation_tree (id, slug, parent_slug, title, sort_order, level, has_children)

-- Full-text search
CREATE VIRTUAL TABLE documents_fts USING fts5(title, content, section, tags, content='documents', content_rowid='id');

-- RAG chunks for AI Q&A
chunks (id, document_id FK, chunk_index, content_text, heading_context)
chunk_embeddings (chunk_id FK, embedding BLOB)  -- float32 vectors via sqlite-vec
```

**Edge cases handled:**
- 57 of 94 files have no frontmatter — derive title from first H1, tags empty
- `README.md` / `*-index.md` files get their parent directory's slug
- Directory names with spaces: `01-Development Guidelines` → `development-guidelines`
- Links pointing outside handbook (`docs/scooda/...`) rendered as plain text with tooltip
- Sort order from numeric prefixes; files without prefix get sort_order 999

**Embedding generation:**
- Chunk each document into ~500-token segments with 50-token overlap
- If `OPENAI_API_KEY` env var is set, generate embeddings via `text-embedding-3-small`
- If not set, skip embeddings (app still works, just without AI Q&A)
- Store as float32 BLOBs in `chunk_embeddings` table

**Verify:**
- `npm run build:handbook` completes without errors
- `SELECT count(*) FROM documents;` → 94
- `SELECT * FROM documents_fts WHERE documents_fts MATCH 'testing';` returns results
- `SELECT count(*) FROM chunks;` → reasonable number (200-400 chunks)
- Spot-check: code blocks have Shiki HTML, internal links have no `.md` extension

---

## Phase 3: Rust Backend — Tauri Commands

- [ ] Complete

**Goal:** Rust commands query handbook.db and expose data to the Vue frontend.

**Create:**
```text
src-tauri/src/
  db.rs                        # Database connection from bundled resource (read-only)
  commands.rs                  # Tauri command implementations
  models.rs                    # Serde structs: Document, NavigationNode, SearchResult, Tag, Chunk
src/lib/
  api.ts                       # TypeScript invoke() wrappers
  types.ts                     # TypeScript interfaces matching Rust models
```

**Commands:**
1. `get_navigation() → Vec<NavigationNode>` — full sidebar tree
2. `get_document(slug) → Document` — single document with HTML
3. `search_documents(query, limit?) → Vec<SearchResult>` — FTS5 search with snippets
4. `get_tags() → Vec<Tag>` — all tags with document counts
5. `get_similar_chunks(query_embedding: Vec<f32>, limit?) → Vec<Chunk>` — vector similarity for RAG

**Database opened read-only** from `app.path().resolve("resources/handbook.db")`.

**Verify:** Call each command via browser console in dev mode — all return correct data.

---

## Phase 4: Core UI — Layout, Navigation, Content

- [ ] Complete

**Goal:** Three-panel layout with sidebar navigation tree, content area rendering handbook pages with beautiful typography. Light mode only initially.

**Create:**
```bash
src/
  router/index.ts              # Routes: / (home), /docs/:slug(.*)
  layouts/AppLayout.vue        # Sidebar + content + titlebar drag region
  components/
    sidebar/
      Sidebar.vue              # Container, collapse toggle, 260px width
      SidebarSection.vue       # Collapsible section (recursive for nesting)
      SidebarLink.vue          # Individual nav link with active state
    content/
      DocumentView.vue         # Renders content_html inside prose classes
      Breadcrumbs.vue          # Slug path → clickable breadcrumb trail
      ContentHeader.vue        # Title + section + tag badges
  composables/
    useNavigation.ts           # Fetch + cache navigation tree, transform to nested structure
    useSidebar.ts              # Collapsed state, active section tracking
  pages/
    HomePage.vue               # Welcome/index content
    DocPage.vue                # Fetches doc by slug param, renders DocumentView
```

**Layout:**
- Sidebar: 260px, collapsible to 0px, independent scroll
- Titlebar drag region: 52px top padding for traffic light clearance
- Content: centred, `max-w-3xl` for optimal reading measure (~65ch)
- `prose prose-lg` classes for typography
- Content links: intercept clicks — internal links navigate via router, external links open in system browser

**Verify:**
- Sidebar shows all 10 sections, expands to show children
- Clicking a document renders its content with proper typography
- Code blocks show syntax highlighting
- Internal links navigate within the app
- Breadcrumbs show correct path
- Sidebar collapse works

---

## Phase 5: Search — Command Palette (Cmd+K)

- [ ] Complete

**Goal:** Polished command palette for instant full-text search. Keyboard-first.

**Create:**
```text
src/components/search/
  CommandPalette.vue           # Modal: search input + results list
  SearchResult.vue             # Title, section badge, snippet with highlighted terms
  SearchEmpty.vue              # Empty/no-results state
src/composables/
  useSearch.ts                 # Debounced FTS5 search (150ms)
  useCommandPalette.ts         # Open/close state, Cmd+K binding
  useKeyboardNavigation.ts     # Arrow keys through results, Enter to select
```

**Behaviour:**
- `Cmd+K` toggles open/close, `Escape` closes
- Semi-transparent backdrop with blur
- Auto-focus input on open
- Results: title, section badge, snippet with `<mark>` highlights
- Arrow key navigation through results
- Enter navigates to selected result and closes
- Max 20 results

**Verify:** Cmd+K opens palette, typing finds documents instantly, keyboard navigation works, selecting navigates correctly.

---

## Phase 6: Dark Mode and Visual Polish

- [ ] Complete

**Goal:** System-aware dark/light mode, vibrancy sidebar, refined typography, subtle animations. This is where the app goes from functional to beautiful.

**Create/modify:**
```bash
src/composables/useTheme.ts    # System detection, manual toggle, localStorage persistence
src/components/ThemeToggle.vue # Light/dark/system toggle
src/style.css                  # Extended: CSS custom properties for colour tokens, dark variants
```

**Colour system** — implement the Design Language colour tokens (see above) via CSS custom properties in `@theme`. Warm paper-like tones, not generic greys. Minimum 4.5:1 contrast ratio (WCAG AA).

**Vibrancy:** `windowEffects` in tauri.conf.json — sidebar gets frosted glass on macOS.

**Micro-animations** (Things-inspired, CSS transitions + `@vueuse/motion` for spring physics):
- Sidebar collapse: `width 250ms` with slight spring overshoot
- Page transitions: content cross-fade 200ms with subtle 2px vertical shift
- Command palette: `opacity + scale(0.97→1.0)` enter, 250ms ease-out
- Sidebar section expand: smooth height + opacity, 200ms
- Sidebar links: soft background fade on hover, 150ms
- Hover states: 150ms colour transitions, no abrupt changes
- All movements should feel physically grounded — ease-out on enter, ease-in on exit

**Depth via shadows** (not borders):
- Sidebar: `box-shadow: 1px 0 0 0 rgba(0,0,0,0.04)` (barely-there edge)
- Command palette: multi-layer shadow (`0 25px 50px -12px rgba(0,0,0,0.25)`)
- Floating elements: soft, diffused shadows that feel like real-world elevation
- Minimal use of `border` — prefer shadow-based separation

**Code blocks:**
- Rounded corners (0.5rem), soft shadow instead of hard border
- `SF Mono` / `Fira Code` / `ui-monospace` font stack
- Warm-tinted background (`#F8F8F5` light / `#2C2C2E` dark)
- Copy-to-clipboard button fades in on hover

**Verify:**
- Follows system dark/light preference on launch
- Toggle persists across restarts
- Sidebar vibrancy visible on macOS
- Both modes feel warm and cohesive — paper-like, not clinical
- All transitions smooth, deliberate, physically grounded
- No theme flash on app start
- Shadows create clear depth hierarchy without harsh borders

---

## Phase 7: AI Q&A — RAG Chat Interface

- [ ] Complete

**Goal:** Optional AI-powered Q&A. Users who provide API keys can ask questions about the handbook and get contextual answers. Users without keys see no AI features.

**Create:**
```text
src-tauri/src/
  ai.rs                        # LLM provider abstraction: OpenAI, Anthropic, Ollama
  settings.rs                  # Encrypted settings storage (API keys)

src/
  components/
    ai/
      AskPanel.vue             # Slide-out panel or inline Q&A interface
      AskInput.vue             # Question input with send button
      AskResponse.vue          # Streaming markdown response
      ProviderBadge.vue        # Shows which provider is active
    settings/
      SettingsModal.vue        # API key configuration
      ProviderConfig.vue       # Per-provider key input + test connection
  composables/
    useAI.ts                   # Send question, manage streaming response
    useSettings.ts             # Load/save API keys via Tauri secure store
  pages/
    SettingsPage.vue           # Full settings view (or modal)
```

**RAG flow:**
1. User types a question
2. Frontend sends question to Rust backend
3. Rust generates embedding for the question (via user's configured provider or Ollama)
4. Vector similarity search against `chunk_embeddings` → top 10 chunks
5. Also run FTS5 search → top 5 results (hybrid retrieval)
6. De-duplicate and rank, take top 8 chunks as context
7. Build prompt: system message + context chunks + user question
8. Stream LLM response back to frontend via Tauri events
9. Frontend renders streaming markdown

**Provider support:**
| Provider | Embedding | Chat | Notes |
|----------|-----------|------|-------|
| OpenAI | text-embedding-3-small | gpt-4o | Most common |
| Anthropic | (use OpenAI embeddings or Ollama) | claude-sonnet | Anthropic doesn't have embedding API |
| Ollama | nomic-embed-text | llama3/mistral | Fully local, no API key needed |

**API key storage:** `tauri-plugin-store` with encrypted JSON file in app data directory.

**Graceful degradation:**
- No API keys configured → AI panel hidden, no mention of AI features
- Keys configured → "Ask" button appears in toolbar, Cmd+Shift+A opens AI panel
- Ollama not running → helpful error message with setup instructions

**Tauri commands:**
- `get_settings() → Settings` — load stored API keys (masked)
- `save_settings(settings) → Result` — save API keys
- `test_provider(provider, key?) → Result` — verify key/connection works
- `ask_question(question, provider?) → ()` — starts streaming; results via events
- `get_embedding(text) → Vec<f32>` — generate embedding for query

**Verify:**
- Without API keys: no AI UI visible anywhere
- Add OpenAI key in settings → test connection succeeds
- Ask a question → relevant handbook context is retrieved → streamed answer appears
- Switch to Anthropic → same flow works
- Ollama (if running locally) → works without any API key
- Streaming response renders markdown progressively

---

## Phase 8: Keyboard Navigation and UX Refinements

- [ ] Complete

**Goal:** Full keyboard navigation, tag filtering, scroll memory, table of contents, and the fine details.

**Create:**
```bash
src/components/content/
  TableOfContents.vue          # Auto-generated from h2/h3 elements, shown on wide viewports
  TagList.vue                  # Clickable tag badges
src/components/sidebar/
  TagFilter.vue                # Tag filter in sidebar
src/composables/
  useTableOfContents.ts        # Extract headings, IntersectionObserver for active heading
  useScrollMemory.ts           # Store/restore scroll position per route
  useKeyboardShortcuts.ts      # Global shortcut registry
  useTags.ts                   # Tag fetching and filter state
src/pages/
  TagPage.vue                  # Documents filtered by tag
```

**Keyboard shortcuts:**
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Search |
| `Cmd+Shift+A` | Ask AI (if configured) |
| `Cmd+\` | Toggle sidebar |
| `Cmd+Shift+L` | Toggle dark mode |
| `Cmd+[` / `Cmd+]` | Navigate back/forward |

**Other refinements:**
- Window title updates: `"Document Title — dalil"`
- Scroll position memory per document (session-only)
- Table of contents in right margin on viewports > 1400px with active heading tracking
- External links open in system browser via `shell.open()`
- Tag page at `/tags/:tag` showing filtered documents

**Verify:** All shortcuts work. Scroll position remembered. TOC tracks active heading. Tags filter correctly.

---

## Phase 9: Distribution and Auto-Updates

- [ ] Complete

**Goal:** Ship-ready builds with auto-update support and proper macOS packaging.

**Create/modify:**
```bash
src-tauri/
  Cargo.toml                   # Add tauri-plugin-updater
  tauri.conf.json              # Updater config, bundle identifier, icons
  icons/                       # App icon set (.icns, .ico, .png at required sizes)
src/
  composables/useUpdater.ts    # Check for updates on launch
  components/UpdateNotification.vue  # "Update available" toast
```

**Build optimisation:**
- Shiki is build-time only (not in frontend bundle)
- Rust release profile: `opt-level = 3`, `lto = true`, `strip = true`, `codegen-units = 1`
- Target `.app` bundle under 30MB
- Auto-updater endpoint: GitHub Releases with `latest.json`

**Verify:**
- `npm run tauri build` produces a `.dmg`
- App launches from built bundle (not dev)
- All features work in production
- Updater checks endpoint on launch

---

## Phase Dependencies

```text
Phase 1 (Scaffold) → Phase 2 (Pipeline) → Phase 3 (Rust Backend) → Phase 4 (UI)
                                                                       ↓
                                                              Phase 5 (Search)
                                                                       ↓
                                                              Phase 6 (Polish)
                                                                       ↓
                                                              Phase 7 (AI Q&A)
                                                                       ↓
                                                              Phase 8 (UX)
                                                                       ↓
                                                              Phase 9 (Distribution)
```

Each phase is independently testable. The app is usable from Phase 4 onwards. AI (Phase 7) is additive — the app works perfectly without it.
