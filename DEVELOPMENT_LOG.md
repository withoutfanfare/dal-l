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
