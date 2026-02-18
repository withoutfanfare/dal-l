# Multi-Project Documentation Viewer

**Date:** 2026-02-18
**Status:** Approved

## Summary

Extend dalil from a single engineering handbook viewer into a multi-project documentation viewer. Users can register projects that point to documentation folders on their machine. The app processes the markdown at runtime and presents it in a consistent interface alongside the built-in Engineering Handbook.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Built-in content | Keep Engineering Handbook as default project | Provides immediate value on first launch |
| Processing time | Runtime (on project add) | No friction — users point to a folder and go |
| Pipeline location | Tauri sidecar (Node.js) | Reuses the entire existing build pipeline with minimal changes |
| Database architecture | One SQLite DB per project | Clean isolation, easy to add/remove projects |
| Project UX | Switcher dropdown in the sidebar | Lightweight, always accessible, familiar pattern |
| Search scope | Active project only | Simple, fast, matches the mental model |

## Architecture

### Data Model

```text
Project (new, runtime-managed)
  +-- Collection (existing — a project can have 1+ collections)
       +-- Documents, Navigation, Tags, Chunks (unchanged)
```

Each project gets its own SQLite database file. The built-in handbook keeps its current bundled `dalil.db`. User project databases are stored in the Tauri app data directory.

```text
~/Library/Application Support/com.dalil.app/
  settings.json          (existing — AI settings)
  projects.json          (new — project registry)
  projects/
    scooda.db            (user project)
    another-project.db   (user project)
```

### Project Registry

A `projects.json` file in the app data directory tracks all registered projects, managed via the Tauri store plugin (same pattern as `settings.json`):

```json
{
  "projects": [
    {
      "id": "engineering-handbook",
      "name": "Engineering Handbook",
      "icon": "book",
      "builtIn": true,
      "dbPath": null
    },
    {
      "id": "scooda",
      "name": "Scooda",
      "icon": "code",
      "builtIn": false,
      "sourcePath": "/Users/danny/Code/scooda/docs",
      "dbPath": "projects/scooda.db",
      "lastBuilt": "2026-02-18T10:00:00Z",
      "collections": [
        {
          "id": "scooda-docs",
          "name": "Documentation",
          "icon": "document",
          "sourceSubpath": "."
        }
      ]
    }
  ],
  "activeProjectId": "engineering-handbook"
}
```

### Data Flow

```bash
Built-in handbook (unchanged):
  dalil.config.ts -> build-handbook.ts (build time) -> bundled dalil.db -> Rust -> Vue

User projects (new):
  Add Project dialog -> Rust spawns sidecar -> sidecar writes project.db -> Rust opens it -> Vue
```

## Runtime Processing via Sidecar

The existing Node.js build pipeline (`build-handbook.ts` + `scripts/lib/`) is packaged as a Tauri sidecar binary. When a user adds or rebuilds a project:

1. User picks a folder via Tauri's native file dialog
2. Rust backend spawns the sidecar: `dalil-builder --source /path/to/docs --output /path/to/project.db`
3. The sidecar runs the existing pipeline (find markdown, parse with remark/rehype, Shiki highlighting, chunk for RAG, write SQLite)
4. Rust opens the new DB read-only and adds it to the project registry
5. Frontend updates to show the new project

### Sidecar Adaptation

The sidecar is the existing `build-handbook.ts` adapted to:

- Accept CLI arguments (`--source`, `--output`, `--collection-id`, `--collection-name`) instead of reading `dalil.config.ts`
- Write to a specified output path instead of the hardcoded `dalil.db` in project root
- Support a single collection per invocation (the Rust backend can call it multiple times for multi-collection projects)
- Exit with appropriate status codes for error handling

### Rebuild Strategy

- **Manual only in v1**: A "Rebuild" button in project settings triggers a re-run of the sidecar
- **No file watching**: Avoids complexity. Users rebuild when they know docs have changed
- **Future**: File watching and incremental rebuilds can be added later

## Rust Backend Changes

### State Management

Replace the single `DbState(Mutex<Connection>)` with a project-aware connection manager:

```rust
pub struct ProjectManager {
    /// Open database connections keyed by project ID
    connections: HashMap<String, Connection>,
    /// Project registry (persisted to projects.json)
    registry: ProjectRegistry,
}
```

Wrapped in `Mutex<ProjectManager>` as Tauri managed state. The built-in handbook connection uses the bundled DB path; user project connections use the app data directory paths.

### New Tauri Commands

| Command | Purpose |
|---------|---------|
| `list_projects()` | Return all registered projects with metadata |
| `add_project(name, icon, source_path)` | Register project, trigger sidecar build, open DB |
| `remove_project(id)` | Close connection, delete DB file, remove from registry |
| `set_active_project(id)` | Switch active project context |
| `rebuild_project(id)` | Re-run sidecar for a project |
| `get_build_status(id)` | Check if a sidecar build is in progress |

### Existing Command Changes

The existing commands (`get_collections`, `get_navigation`, `get_document`, `search_documents`, `get_tags`, `get_documents_by_tag`, `get_similar_chunks`) operate on the **active project's database connection**. The `ProjectManager` resolves which connection to use based on the active project ID.

This means the existing frontend API calls require minimal changes — they continue to call the same commands, which now implicitly query the active project.

### Build Progress Events

The sidecar build can emit progress via Tauri events:

- `project-build-started { projectId }` — build has begun
- `project-build-progress { projectId, message }` — status updates (e.g. "Processing 15/93 files")
- `project-build-complete { projectId }` — build finished successfully
- `project-build-error { projectId, error }` — build failed

## Frontend Changes

### New Components

**ProjectSwitcher** — Replaces the top area of the sidebar, above the existing `CollectionSwitcher`. Displays the active project name and icon with a dropdown listing:

- All registered projects (click to switch)
- Divider
- "Add Project..." action (opens the add dialog)

**AddProjectDialog** — Modal with:

- Project name (text input, required)
- Icon picker (emoji or simple icon set)
- Documentation folder (native folder picker via Tauri dialog API)
- "Add" button triggers the sidecar build
- Progress indicator during build

**Project context menu** — Right-click (or gear icon) on a project in the switcher:

- Rebuild documentation
- Edit project details
- Remove project (with confirmation)

### Modified Components

**Sidebar.vue** — Add `ProjectSwitcher` above the existing `CollectionSwitcher`. The collection switcher is hidden when a project has only one collection.

**AppLayout.vue** — Load projects on mount (similar to how collections are loaded today).

### New Composable

**useProjects** — Manages project state:

```typescript
// Reactive state
const projects: Ref<Project[]>
const activeProjectId: Ref<string>
const activeProject: ComputedRef<Project | undefined>
const buildStatus: Ref<Map<string, BuildStatus>>

// Actions
function loadProjects(): Promise<void>
function addProject(name: string, icon: string, sourcePath: string): Promise<void>
function removeProject(id: string): Promise<void>
function setActiveProject(id: string): Promise<void>
function rebuildProject(id: string): Promise<void>
```

When the active project changes, `useCollections` reloads its data from the new project's database.

### Existing Composables

**useCollections** — Gains a `reload()` method (already exists) that is called when the active project switches. The composable itself does not need to know about projects — it just queries whichever DB is active.

**useNavigation** — No changes. Reloads naturally when collection changes.

**useCommandPalette / useSearch** — No changes. Search already accepts a `collectionId` parameter and queries the active DB.

## What Doesn't Change

- The entire markdown processing pipeline (remark, rehype, Shiki, chunking, FTS5)
- The SQLite schema (each project DB has identical tables)
- All existing Vue page components (HomePage, DocPage, TagPage)
- Content rendering (prose styling, code blocks, TOC)
- The command palette and search behaviour (scoped to active project)
- Theme system, keyboard shortcuts, layout structure
- The AI Q&A feature (when re-enabled, queries active project's chunks)
- The auto-updater and distribution pipeline

## Implementation Phases

### Phase 1: Project Registry and State Management

- Define `Project` and `ProjectRegistry` types (Rust + TypeScript)
- Implement `projects.json` persistence via Tauri store
- Replace `DbState` with `ProjectManager` that manages multiple connections
- Register the built-in handbook as the default project
- Implement `list_projects`, `set_active_project` commands
- Ensure all existing commands route through the active project's connection

### Phase 2: Sidecar Build Pipeline

- Adapt `build-handbook.ts` to accept CLI arguments
- Configure the sidecar in `tauri.conf.json`
- Implement `add_project` command (register + spawn sidecar + open DB)
- Implement `rebuild_project` command
- Add build progress events
- Implement `remove_project` command (close connection, delete DB, update registry)

### Phase 3: Frontend — Project Switcher

- Create `useProjects` composable
- Build `ProjectSwitcher` component
- Wire into `Sidebar.vue` above the collection switcher
- Connect project switching to collection/navigation reload

### Phase 4: Frontend — Add/Manage Projects

- Build `AddProjectDialog` with folder picker
- Add build progress UI (spinner/progress bar during sidecar execution)
- Add project context menu (rebuild, edit, remove)
- Handle error states (missing folder, build failures)

### Phase 5: Polish and Edge Cases

- Handle missing source folders gracefully (project still shows but with a warning)
- Persist active project across app restarts
- Ensure the built-in handbook cannot be removed
- Test with multiple simultaneous projects
- Update keyboard shortcuts help if needed
