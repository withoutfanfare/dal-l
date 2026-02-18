# Dalil UX/UI Improvements — Implementation Plan

**Date:** 2026-02-18  
**Status:** In Progress

## Goal

Deliver a cohesive UX/UI improvement programme that makes Dalil more pleasant and useful, with priority on:

1. Per-project bookmarks that scale to large personal libraries
2. Reliable text selection/copy and section sharing
3. Deep links that resolve correctly across machines
4. Visibility into documentation changes
5. Robust re-enabled AI features using user-provided provider keys

## Scope

### In Scope

1. Bookmarking pages and sections (per project)
2. Copy/select improvements in doc views
3. Shareable section links (`dalil://`) with robust resolver behavior
4. “What changed”/updated indicators for documentation
5. AI robustness and UX for OpenAI/Anthropic/Gemini key-based usage
6. Command palette, keyboard, continue-reading, compare, notes/highlights, and search ranking improvements

### Out of Scope (This Plan)

1. Cloud sync / multi-device bookmark sync
2. Team-shared annotations with permissions
3. Full cross-project global AI context beyond active project

## Product Principles

1. Project context first: state and actions should always be scoped to the active project.
2. Fast at scale: bookmark and search interactions must remain responsive with thousands of records.
3. Recoverable UX: broken links and missing docs should surface clear fallback paths, never silent failure.
4. Keyboard parity: all primary actions available by keyboard and command palette.
5. Safe AI by default: clear provider/model selection, explicit errors, and citation-grounded responses.

## Workstreams

## 1) Bookmark System (Primary)

### UX Requirements

1. Bookmarks are stored and browsed per project.
2. Users can bookmark full docs and anchored sections.
3. Users can manage large sets via folders, tags, sorting, and bulk actions.
4. Users can quickly access bookmarks from top bar + command palette + collection-scoped bookmark pages.

### Technical Approach

Use a separate writable user-state database in app data (not project read-only DBs):

- `user_state.db`
  - `bookmarks(id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index)`
  - `bookmark_folders(id, project_id, name, created_at, updated_at)`
  - `bookmark_folder_items(folder_id, bookmark_id)`
  - `bookmark_tags(id, project_id, name)`
  - `bookmark_tag_items(tag_id, bookmark_id)`
  - `bookmark_events(id, bookmark_id, event_type, created_at)`

Indexes:

1. `(project_id, updated_at DESC)`
2. `(project_id, doc_slug, anchor_id)`
3. `(project_id, title_snapshot)`

### Acceptance Criteria

1. Add/remove/open bookmark completes under 150ms median.
2. Manage view remains smooth with 2,000+ bookmarks.
3. Bookmarks never bleed between projects.
4. If target doc/anchor is missing, user gets “Repair / Open nearest / Delete” options.

## 2) Copy + Share + Deep-Link Reliability

### UX Requirements

1. Text is selectable in content areas by default.
2. Heading actions provide one-click “Copy section link”.
3. Shared links resolve on another user’s machine with graceful fallback.

### Technical Approach

Define a canonical deep-link format:

`dalil://project/{projectId}/collection/{collectionId}/doc/{docSlug}#${anchorId}`

Resolver behavior:

1. If project exists: route directly.
2. If project missing: prompt to switch/add project, preserve target payload.
3. If doc missing: open nearest path candidate + show resolution banner.
4. If anchor missing: open doc top + show “section moved” notice.

### Acceptance Criteria

1. 95%+ shared links open target doc correctly when same source docs exist.
2. All failure cases show actionable fallback UI.
3. Copy affordances are keyboard accessible and discoverable.

## 3) Documentation Update Visibility

### UX Requirements

1. Users can see what changed since they last viewed docs.
2. Users can quickly access recent updates per active project.

### Technical Approach

1. Use existing `last_modified` metadata for baseline “updated” badges.
2. Store per-user `last_viewed_at` per doc in user-state DB.
3. During project rebuild, collect git metadata from source path to produce change feed:
   - commit hash
   - author/date
   - changed files
   - changed doc slugs

UI surfaces:

1. Sidebar badges for changed docs
2. Home “Recently updated” panel
3. Optional “What changed” drawer

### Acceptance Criteria

1. Users can filter to “Updated since I last viewed”.
2. Change feed links open exact affected docs.
3. Rebuild completion updates badges without app restart.

## 4) AI Robustness + Re-enable

### UX Requirements

1. Existing hidden AI features become re-enabled behind safe rollout flags.
2. Provider key setup for OpenAI, Anthropic, Gemini with clear status.
3. Streaming responses are cancellable, isolated per request, and error-transparent.

### Technical Approach

1. Re-enable `AskPanel` + `SettingsModal` pathways behind feature flag.
2. Expand provider settings model for Gemini key/config.
3. Harden request lifecycle:
   - cancellation token per request
   - strict listener cleanup
   - timeout + retry policy
   - provider-specific error mapping
4. Source-grounded responses:
   - attach cited chunk/doc references
   - safer rendering for streamed content

### Acceptance Criteria

1. No interleaved streaming responses under rapid repeat prompts.
2. Provider connection tests are deterministic and non-destructive.
3. AI responses show source references for documentation-derived answers.

## 5) Power Usability Enhancements

### Features

1. Command palette expansion (`Cmd/Ctrl+K`) for bookmark/share/jump actions
2. Continue-reading home state (last visited, pinned, updated docs)
3. Keyboard shortcuts (`b` bookmark, `s` share, `/` search, navigation keys)
4. Compare mode (current vs previous revision)
5. Personal notes/highlights (private, per-project)
6. Search ranking boosts (bookmarks/recency/project relevance)

### Acceptance Criteria

1. Core flows executable without mouse.
2. Continue-reading reduces repeat-navigation friction.
3. Compare mode reliably highlights changed sections.

## 6) Navigation Continuity + Tabs

### UX Requirements

1. Users can move backward/forward through docs without losing context.
2. Users can see and reopen recently viewed docs quickly.
3. Users can keep multiple docs open as tabs.
4. Tab state is persisted per collection/folder.
5. Navigation controls work well in limited top-bar space and remain keyboard accessible.

### Technical Approach

1. Add top-bar history controls (Back/Forward) with disabled states and keyboard parity.
2. Add compact “Recently viewed” popover with recency ordering and per-collection grouping.
3. Add tab strip for active docs:
   - tab open, close, reorder
   - active tab highlight
   - overflow handling in constrained widths
4. Persist tabs and active-tab pointer in user state store keyed by `project_id + collection_id`.
5. Restore tabs automatically when returning to a collection.

### Acceptance Criteria

1. Back/Forward works for doc-to-doc traversal and never drops user to an unexpected page.
2. Recently viewed opens target docs in <= 2 clicks.
3. Tab state survives app restart and collection switching.
4. Tab overflow remains usable on narrow widths (no inaccessible tabs).

## Delivery Plan (10 Weeks)

## Phase 1 (Weeks 1-2): Foundations + Quick Wins

1. Instrumentation for feature usage and error events
2. Copy/select polish and heading action consistency
3. Feature flags for AI and advanced UX modules

## Phase 2 (Weeks 3-4): Bookmark Core

1. Build user-state storage + commands
2. Add bookmark create/open/delete from doc view
3. Create Bookmarks management page (filter/sort/bulk)

## Phase 3 (Weeks 5-6): Share + Deep Links + Update Signals

1. Deep-link schema v2 and resolver fallback flows
2. Sharing actions in doc header + heading anchors
3. Updated-since-last-viewed badges and recent updates panel

## Phase 4 (Weeks 7-8): AI Harden + Re-enable

1. Re-enable hidden AI UX behind flag
2. Add Gemini support and robust key-management UX
3. Improve streaming reliability, cancellation, and cited output

## Phase 5 (Weeks 9-10): Power UX

1. Command palette and keyboard upgrades
2. Continue-reading, compare mode, notes/highlights
3. Search ranking tuning and polish pass

## Phase 6 (Week 11+): Navigation Continuity + Tabs

1. Top-bar Back/Forward + Recently viewed
2. Multi-tab docs with per-collection persistence
3. Overflow, keyboard, and restore behavior polish

## User Stories (Core)

```gherkin
As a documentation user,
I want to save bookmarks per project,
So that I can quickly return to important pages and sections.

Given I am in project A
When I bookmark a section
Then it appears in project A bookmarks only
And I can find it by search, tag, or folder.
```

```gherkin
As a documentation user,
I want to share a section link with another user,
So that they can open the same location on their machine.

Given I copy a section link
When another user opens it in Dalil
Then Dalil routes to the correct project/doc/anchor when available
And shows a guided fallback if not available.
```

```gherkin
As a documentation user,
I want to see what changed since I last visited,
So that I can focus on new or updated guidance.

Given docs have been rebuilt with updates
When I open the app
Then updated docs are clearly marked
And I can open a recent changes list for my active project.
```

```gherkin
As a user with my own AI keys,
I want reliable AI assistance grounded in project docs,
So that I can trust and act on the answers.

Given my provider key is configured
When I ask a question
Then I receive a streamed response with citations
And I can cancel, retry, or switch provider without UI breakage.
```

```gherkin
As a documentation user,
I want back/forward history and recently viewed navigation,
So that I can move around documentation quickly without losing my place.

Given I have opened several docs
When I use top-bar Back/Forward or Recently viewed
Then Dalil opens the expected document in context
And my navigation state remains consistent.
```

```gherkin
As a documentation user,
I want multiple document tabs that persist per folder,
So that I can keep a working set of docs open as I switch tasks.

Given I open multiple docs in a folder
When I close and reopen Dalil or switch folders and return
Then my tabs restore for that folder
And the last active tab is selected.
```

## Information Architecture Updates

1. Sidebar
   - Add update indicator counts per project/collection
2. Top bar
   - Add “Bookmarks” quick panel with scalable list + filter
   - Add Back/Forward controls
   - Add “Recently viewed” quick access
   - Add tab strip (with overflow behavior)
3. Home
   - Add “Continue Reading” and “Recently Updated”
4. Doc Page
   - Add share actions in header and per heading
   - Add right sidebar for bookmarks, personal notes, and highlights
5. Global
   - Extend command palette actions for bookmark/share/navigation

## QA and Validation Plan

1. Functional tests for bookmark CRUD, filters, bulk actions, and scale behavior
2. Deep-link tests across:
   - valid project/doc/anchor
   - missing project
   - missing doc
   - missing anchor
3. Rebuild/update badge tests with simulated git changes
4. AI tests:
   - provider setup and masking
   - timeout/cancel behavior
   - concurrent ask isolation
5. Accessibility checks:
   - keyboard complete paths
   - visible focus
   - WCAG AA contrast
6. Navigation continuity tests:
   - Back/Forward behavior across docs/collections
   - recently viewed ordering and open behavior
   - tab persistence per collection

## Success Metrics

1. Bookmark open time < 150ms median
2. 95%+ deep-link resolution in like-for-like environments
3. ≥ 60% weekly active users engage with bookmark/update/share features
4. AI error rate < 2% for configured providers (excluding external outage windows)
5. SUS usability score target ≥ 80 for documentation navigation tasks

## Risks and Mitigations

1. **Risk:** Bookmark scale causes performance degradation  
   **Mitigation:** Indexed storage, virtualized lists, bounded render windows.

2. **Risk:** Deep-link schema changes break existing links  
   **Mitigation:** Backward-compatible parser and migration support for old format.

3. **Risk:** Git metadata unavailable in some project sources  
   **Mitigation:** Fallback to `last_modified` only with reduced change-detail UI.

4. **Risk:** AI provider instability causes poor UX  
   **Mitigation:** timeout/retry/cancel, clear status, provider switching controls.

5. **Risk:** Multi-tab UX becomes cramped and confusing in limited top-bar space  
   **Mitigation:** compact tab labels, overflow menu, pinned recent list, and strict keyboard support.

## Implementation Tracker (As of 2026-02-18)

### Completed

1. User-state bookmark system with folders/tags/bulk actions and per-project isolation.
2. Bookmark recovery flow (“Repair / Open nearest / Delete”) for missing targets.
3. Deep-link v2 format + legacy parsing and fallback handling for missing doc/anchor.
4. Copy/share improvements in doc content (heading section link copy + copy polish).
5. Updated-since-viewed activity model and home “Continue Reading / Recently Updated” surfaces.
6. Re-enabled AI panel and settings behind feature flag with Gemini support and request-scoped cancel handling.
7. Compare mode and personal notes/highlights (now in the right doc sidebar).
8. Top-bar bookmarks panel and collection-scoped bookmarks pages (`/bookmarks/:collection?`).

### Outstanding (Prioritized)

1. Bookmark scalability polish:
   - virtualized lists for large bookmark volumes
   - pinned/favourite bookmarks
   - keyboard shortcut to open top-bar bookmarks panel
2. Deep-link missing-project guided resume flow:
   - “switch/add project” prompt with preserved target payload
3. Documentation change feed UI:
   - “What changed” drawer powered by captured git change feed
4. AI citation UX:
   - explicit citation rendering in AI responses (doc/chunk references)
5. Navigation continuity:
   - top-bar Back/Forward controls
   - top-bar Recently viewed panel
6. Multi-document tabs:
   - open/close/reorder tabs
   - per-collection persistence and restore
7. Search ranking tuning:
   - recency/bookmark/project relevance weighting refinement

## Immediate Next Execution Step

Execute Navigation Continuity + Tabs design spike first (top-bar layout and overflow behavior), then implement persisted tab model and recently viewed integration, followed by bookmark virtualization and AI citation UI completion.
