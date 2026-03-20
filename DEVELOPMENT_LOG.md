# Dalil Development Log

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
