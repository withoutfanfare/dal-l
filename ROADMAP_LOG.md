# Dalil Roadmap Log

## Cycle: 2026-03-19 08:00
- **Items added:**
  - [Quality] Sanitise AI response and handbook HTML to prevent XSS (P1, M)
  - [Performance] Optimise AI streaming response rendering (P2, M)
  - [Performance] Parallelise markdown build pipeline (P3, M)
- **Items archived:** none
- **Observations:** Initial roadmap seeding. The February 2026 audit surfaced 3 blocker security issues and 6 major bugs. XSS sanitisation is the top priority before wider distribution. Performance work on streaming rendering and the build pipeline would improve both developer and user experience significantly.

## Cycle: 2026-03-19 15:00
- **Items added:** none
- **Items archived:** none
- **Observations:** No new items added. The existing P1 XSS item already bundles the release-mode DB path resolution fix in its acceptance criteria, covering 2 audit findings in one item. The remaining audit findings (beyond the 3 tracked items) are lower severity and can be added once the current P1 is resolved. Category gaps in Feature and UX/UI are noted — a bookmarking/reading progress feature and collection management UI are natural candidates for the next cycle.

## Cycle: 2026-03-19 22:00
- **Items added:**
  - [Feature] Add bookmark and reading progress tracking (P2, M)
  - [UX/UI] Add in-document table of contents for long pages (P2, S)
  - [Feature] Add cross-collection related content suggestions (P3, M)
- **Items archived:** none
- **Observations:** Acted on the previous cycle's recommendation to add Feature and UX/UI items. Bookmarking and reading progress directly address the core handbook reference workflow — engineers revisiting dense material need to pick up where they left off. The in-document TOC is a high-impact, low-effort UX improvement for long reference pages. Cross-collection related content leverages the existing FTS infrastructure to help users discover relevant material across handbooks. Dalil now has 6 pending items across 4 categories (Quality, Performance, Feature, UX/UI); Distribution and Innovation gaps are acceptable given the P1 security fix should be resolved first.

## Cycle: 2026-03-20 06:00
- **Items added:**
  - [Innovation] Add AI-powered page summarisation for long handbook documents (P3, M)
- **Items archived:** none
- **Observations:** Filled the Innovation category gap. Page summarisation leverages Dalil's existing AI provider infrastructure (already used for Q&A) to solve a real user problem — quickly determining if a dense handbook page is relevant before committing to reading it. Distribution remains absent but is less urgent until the P1 XSS fix ships and the shared component library extraction is complete. Dalil now has 9 pending items (7 feature + 2 shared component library).

## Cycle: 2026-03-20 12:00
- **Items added:**
  - [Distribution] Add handbook source change detection with rebuild prompting (P2, S)
- **Items archived:** none
- **Observations:** Filled the Distribution category gap that was noted as absent in previous cycles. This item addresses a real workflow pain point: the handbook DB is built from markdown sources via a manual step, and there is no indication when the built DB is out of date. File watching during development mode with a "Rebuild now" toast notification eliminates silent staleness. Dalil now has 10 pending items (8 functional + 2 shared component library) across all 6 categories. The P1 XSS sanitisation remains the top priority before any distribution-related work.

## Cycle: 2026-03-19 22:30
- **Items added (Shared Component Library section):**
  - [Foundation] Extract core UI components into @stuntrocket/ui shared package (P1, XL)
  - [Foundation] Refactor Dalil to consume @stuntrocket/ui instead of local components (P1, L)
- **Items archived:** none
- **Observations:** Added Shared Component Library section. Dalil is the reference implementation of the Scooda design system — it must extract its components into @stuntrocket/ui before other apps can adopt them. The extraction (XL) is the largest single item across the portfolio and is the critical-path dependency for all 8 other apps' design system adoption. The self-consumption refactor (L) validates the extraction is complete and proves the package works in production. Both items are P1 because the entire cross-app design uniformity initiative depends on them.

## Cycle: 2026-03-20 18:00
- **Items added:**
  - [Feature] Add recently viewed documents list for quick navigation (P2, S)
- **Items archived:** none
- **Observations:** Added one small item targeting the core reference workflow. Engineers use the same handful of handbook pages daily — having to search or navigate the tree each time adds unnecessary friction. A "Recently Viewed" sidebar section is a standard pattern in document viewers and builds on existing SQLite infrastructure. Dalil is now at 12 pending items (10 functional + 2 shared component library). The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation, recents) forms the strongest next batch after the shared component library extraction work.

## Cycle: 2026-03-20 22:00
- **Items added:**
  - [UX/UI] Add search result context snippets with query term highlighting (P2, S)
- **Items archived:** none
- **Observations:** Added one small item addressing a fundamental search UX gap. Dalil's FTS5 search returns matching documents but shows no context about where or how the query matches — users must click into each result to evaluate relevance. Context snippets with highlighted terms are standard in every search interface and FTS5's built-in `snippet()` function makes implementation straightforward. Dalil is now at 13 pending items (11 functional + 2 shared component library). The completed XSS item remains the only execution evidence. The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation, recents, search snippets) is the strongest next batch after the shared component library extraction work.

## Cycle: 2026-03-20 23:30
- **Items added:**
  - [UX/UI] Add code block copy-to-clipboard button (P2, S)
  - [Quality] Add document word count and estimated reading time (P3, S)
- **Items archived:** none
- **Observations:** Both additions target the core handbook reading experience. The copy button (P2, S) is arguably the most impactful small item remaining — engineering handbooks are full of code snippets, CLI commands, and config examples that developers need to copy, and the current select-and-copy workflow is fiddly. This is a standard feature in every documentation tool (MDN, GitHub, Docusaurus). Word count and reading time (P3, S) helps engineers gauge page length before committing to reading, especially useful during on-call when time is limited. Dalil is now at 15 pending items (13 functional + 2 shared component library) — at the threshold. No further additions until execution begins. The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation, recents, search snippets, code copy) is the strongest next batch.

## Cycle: 2026-03-21 02:09
- **Items added:** none
- **Items archived:** none
- **Observations:** Dalil is at exactly 15 pending items (13 functional + 2 shared component library) — the rebalancing threshold. No additions warranted. One completed item (XSS sanitisation) remains the only execution evidence. The shared component library extraction (P1, XL) is the critical-path dependency for the entire portfolio's design system adoption and should be the highest priority. The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation, recents, search snippets, code copy) provides strong options for parallel work alongside the library extraction.

## Cycle: 2026-03-19 23:29
- **Items added:**
  - [Quality] Add internal link validation at build time (P2, S)
  - [UX/UI] Add print-friendly document export (P3, S)
- **Items archived:** none
- **Observations:** Both additions are small (S) and address content lifecycle gaps that complement the existing handbook management items. Internal link validation catches broken cross-document references during the build pipeline — essential as handbooks grow and documents are reorganised, and it naturally extends the existing remark plugin infrastructure. Print-friendly export makes handbook content portable for meetings and offline use. Dalil now has 11 pending items (9 functional + 2 shared component library) and 1 completed. The completed XSS sanitisation item shows execution momentum. The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation) forms the strongest next batch.

## Cycle: 2026-03-20 08:00
- **Items added:** none
- **Items archived:** none
- **Observations:** Dalil is at 15 pending items (13 functional + 2 shared component library) — at the rebalancing threshold. The shared component library extraction (P1, XL) remains the critical-path dependency for the entire portfolio's design system adoption and should be the highest priority. One completed item (XSS sanitisation). The P2 functional cluster (AI streaming, bookmarks, TOC, change detection, link validation, recents, search snippets, code copy) provides strong parallel work options. No additions until execution reduces the pending count.

## Cycle: 2026-03-20 16:00
- **Items added:**
  - [Feature] Add AI Q&A conversation history with session persistence (P2, S)
  - [UX/UI] Add keyboard shortcuts for document navigation and common actions (P2, S)
  - [Quality] Add content freshness indicators showing source file last-modified dates (P3, S)
- **Items archived:** none
- **Observations:** Dalil has the strongest execution velocity of any app — 7 completed items (TOC, link validation, print export, search snippets, recently viewed, code copy, XSS sanitisation) cleared significant backlog, bringing the pending count down to 9 before this cycle. Added three items to backfill the gaps. AI Q&A history (P2, S) addresses the biggest functional gap in the AI integration — conversations are ephemeral despite being valuable reference material. Keyboard shortcuts (P2, S) fill a surprising absence given every other app in the portfolio has or plans keyboard shortcuts. Content freshness (P3, S) helps users assess handbook currency without checking git history. Dalil is now at 12 pending items (10 functional + 2 shared component library). The shared component library extraction (P1, XL) remains the portfolio-critical dependency. The P2 cluster (AI streaming, bookmarks, change detection, Q&A history, keyboard shortcuts) is the strongest functional batch.

## Cycle: 2026-03-20 21:00
- **Items added:**
  - [UX/UI] Add configurable reading preferences for content display (P3, S)
- **Items archived:** none
- **Observations:** Added one small item targeting the daily reading experience. Engineers using Dalil as a reference tool spend extended sessions reading dense content, but have no way to adjust font size, content width, or line spacing for comfort. This leverages the existing Tauri store settings infrastructure and affects only the content area. Dalil is now at 13 pending items (11 functional + 2 shared component library). Seven completed items show the strongest execution velocity in the portfolio. The shared component library extraction (P1, XL) remains the portfolio-critical dependency. The P2 cluster (AI streaming, bookmarks, change detection, Q&A history, keyboard shortcuts) is the strongest functional batch.

## Cycle: 2026-03-21 08:00
- **Items added:**
  - [Quality] Add FTS index consistency verification on database load (P2, S)
  - [UX/UI] Add collection-level reading progress indicators (P3, S)
- **Items archived:** none
- **Observations:** Dalil continues to show the strongest execution velocity — the only app with significant completed work. The two additions fill the Quality category gap (no pending quality items after XSS completion) and enhance the reading experience. FTS consistency verification (P2, S) addresses a real risk: interrupted builds or external database modifications can desynchronise the search index, causing silent search failures — a critical issue for a tool whose value depends on reliable search. Collection reading progress (P3, S) supports structured handbook consumption during onboarding. Dalil is now at 11 pending items (9 functional + 2 shared component library). The shared component library extraction (P1, XL) remains the portfolio-critical dependency blocking all other apps' design system adoption.

## Cycle: 2026-03-20 20:00
- **Items added:**
  - [UX/UI] Add document breadcrumb navigation showing collection and parent path (P2, S)
  - [Feature] Add multi-collection search scope selector for targeted queries (P3, S)
- **Items archived:** none
- **Observations:** Added two small items targeting navigation and search precision. Breadcrumb navigation (P2, S) addresses a spatial awareness gap — users arriving at documents via search or cross-collection links lose context about where they are in the handbook hierarchy. The search scope selector (P3, S) improves search precision for installations with multiple loaded handbooks, allowing users to restrict queries to a specific collection rather than wading through results from all collections. Both are lightweight (S) and build on existing data structures. Dalil is now at 13 pending items (11 functional + 2 shared component library). The shared component library extraction (P1, XL) remains the portfolio-critical dependency. The P2 functional cluster (AI streaming, bookmarks, change detection, FTS consistency, breadcrumbs) is the strongest next batch.

## Cycle: 2026-03-21 14:00
- **Items added:** none
- **Items archived:** none
- **Observations:** Dalil is at 15 pending items (13 functional + 2 shared component library) — at the rebalancing threshold. The shared component library extraction (P1, XL) remains the portfolio-critical dependency blocking all other apps' design system adoption. The P2 functional cluster (AI streaming, bookmarks, change detection, FTS consistency, breadcrumbs, code copy, recents) provides strong options for parallel work alongside the library extraction. Dalil's execution velocity has been the strongest in the portfolio and it should continue to lead. No additions until execution reduces the pending count.

## Cycle: 2026-03-20 08:14
- **Items added:**
  - [UX/UI] Add code block copy-to-clipboard button (P2, S)
  - [Feature] Add recently viewed documents list for quick navigation (P2, S)
- **Items archived:** none
- **Observations:** Re-added two high-value items that were previously completed then lost during ROADMAP regeneration. The code block copy button (P2, S) is arguably the most impactful small item for a handbook tool — developers copy code snippets, CLI commands, and config examples constantly, and the current select-and-copy workflow is error-prone. The recently viewed list (P2, S) addresses the most common navigation pattern for reference material. Both are standard features in every documentation tool and conspicuously absent. Dalīl is now at 15 pending items (13 functional + 2 shared component library) — at the rebalancing threshold. Seven completed items demonstrate the strongest execution velocity in the portfolio. The shared component library extraction (P1, XL) remains the portfolio-critical dependency blocking all other apps' design system adoption. The P2 cluster (AI streaming, bookmarks, change detection, FTS consistency, breadcrumbs, code copy, recents) provides strong options for parallel work.

## Cycle: 2026-03-20 22:30
- **Items added:** none
- **Items archived:** none
- **Observations:** Dalīl remains at 15 pending items (13 functional + 2 shared component library) — at the rebalancing threshold. No new completions since last cycle. The shared component library extraction (P1, XL) remains the portfolio-critical dependency — every other app's Design System Foundation item is blocked on this work. Reviewed P3 items for archival: parallelise build pipeline (M), cross-collection suggestions (M), AI summarisation (M), search scope selector (S), collection progress (S) — all retain value for a handbook tool used daily. The code block copy button (P2, S) and in-document TOC (P2, S) remain the highest-impact small items for daily handbook usage. No additions until execution reduces the pending count.

## Cycle: 2026-03-20 20:30
- **Items added:**
  - [UX/UI] Add keyboard shortcut help overlay (P2, S)
- **Items archived:**
  - [Performance] Parallelise markdown build pipeline (P3, M) — developer-facing build optimisation with no user-visible impact; current build times acceptable for handbook sizes in use
- **Observations:** Added one item and archived one to maintain the 15-item threshold. The keyboard shortcut overlay (P2, S) fills a surprising gap — Dalil has the most comprehensive keyboard support of any app in the portfolio (useKeyboardNavigation, useKeyboard composables covering document traversal, search, sidebar, theme) but these shortcuts are completely undiscoverable. Every other app has keyboard shortcut documentation planned or implemented; Dalil should lead by example. The archived build pipeline parallelisation (P3, M) was a developer-facing optimisation with no user impact — build times are acceptable at current handbook sizes, and the content-hash skip optimisation (the most valuable part) could be extracted as a standalone item if needed. Dalil remains at 15 pending items (13 functional + 2 shared component library). The shared component library extraction (P1, XL) remains the portfolio-critical dependency. The code block copy button (P2, S), in-document TOC (P2, S), and keyboard shortcut overlay (P2, S) form a strong trio of small items for daily handbook usage improvement.
