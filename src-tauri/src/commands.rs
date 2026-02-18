use crate::ai;
use crate::db::{handbook_db_path, HttpClient};
use crate::models::*;
use crate::projects::ProjectManager;
use crate::settings;
use crate::user_state::UserStateDb;
use rusqlite::{params, OptionalExtension};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub fn get_project_stats(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    project_id: String,
) -> Result<ProjectStats, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;

    let conn = mgr
        .connections
        .get(&project_id)
        .ok_or_else(|| format!("No database connection for project '{}'", project_id))?;

    let document_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM documents", [], |row| row.get(0))
        .unwrap_or(0);
    let collection_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM collections", [], |row| row.get(0))
        .unwrap_or(0);
    let tag_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM tags", [], |row| row.get(0))
        .unwrap_or(0);
    let chunk_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM chunks", [], |row| row.get(0))
        .unwrap_or(0);
    let embedding_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM chunk_embeddings", [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    // Determine DB file path for size calculation
    let project = mgr.registry.projects.iter().find(|p| p.id == project_id);
    let db_size_bytes = if let Some(p) = project {
        if p.built_in {
            let path = handbook_db_path(&app);
            std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
        } else if let Some(ref relative_path) = p.db_path {
            let app_data_dir = app.path().app_data_dir().unwrap_or_default();
            let path = app_data_dir.join(relative_path);
            std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        }
    } else {
        0
    };

    Ok(ProjectStats {
        document_count,
        collection_count,
        tag_count,
        chunk_count,
        embedding_count,
        db_size_bytes,
    })
}

#[tauri::command]
pub async fn open_in_editor(
    app: AppHandle,
    editor_command: String,
    path: String,
) -> Result<(), String> {
    app.shell()
        .command(&editor_command)
        .args([&path])
        .spawn()
        .map_err(|e| format!("Failed to open editor '{}': {}", editor_command, e))?;
    Ok(())
}

#[tauri::command]
pub fn get_preferences(app: AppHandle) -> Result<AppPreferences, String> {
    settings::load_preferences(&app)
}

#[tauri::command]
pub fn save_preferences(app: AppHandle, preferences: AppPreferences) -> Result<(), String> {
    settings::save_preferences_to_store(&app, &preferences)
}

fn unix_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
}

fn unix_timestamp_i64() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

fn resolve_node_binary() -> Option<String> {
    // Prefer PATH first, then common macOS install locations.
    let candidates = [
        "node",
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];

    for candidate in candidates {
        let ok = std::process::Command::new(candidate)
            .arg("--version")
            .output()
            .map(|out| out.status.success())
            .unwrap_or(false);
        if ok {
            return Some(candidate.to_string());
        }
    }

    None
}

fn resolve_project_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        // Dev mode: command is often run from repo root.
        candidates.push(cwd.clone());

        // Dev mode: command can also run from src-tauri/.
        if cwd.ends_with("src-tauri") {
            let mut parent = cwd.clone();
            parent.pop();
            candidates.push(parent);
        }
    }

    // Build-time repo path (useful when packaged app still runs on build host).
    if let Some(parent) = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
    {
        candidates.push(parent);
    }

    // Optional runtime resource fallback.
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.clone());
        if let Some(parent) = resource_dir.parent() {
            candidates.push(parent.to_path_buf());
        }
    }

    for candidate in candidates {
        if candidate.join("scripts/build-handbook.ts").exists() {
            return Ok(candidate);
        }
    }

    Err("Could not locate project build scripts. Reinstall the app or run from a development checkout."
        .to_string())
}

#[derive(Debug)]
struct BuildCommandResult {
    success: bool,
    stderr: String,
}

fn normalise_build_error(stderr: &str) -> String {
    let trimmed = stderr.trim();
    if trimmed.is_empty() {
        "Unknown build failure".to_string()
    } else {
        trimmed.to_string()
    }
}

fn is_better_sqlite3_abi_mismatch(stderr: &str) -> bool {
    let lower = stderr.to_ascii_lowercase();
    (lower.contains("node_module_version") || lower.contains("err_dlopen_failed"))
        && lower.contains("better_sqlite3")
}

async fn execute_project_build_command(
    app: &AppHandle,
    node_bin: &str,
    project_root: &std::path::Path,
    tsx_cli_path: &std::path::Path,
    script_path: &std::path::Path,
    source_path: &str,
    db_path: &std::path::Path,
    collection_id: &str,
    collection_name: &str,
    collection_icon: &str,
    openai_api_key: Option<&str>,
) -> Result<BuildCommandResult, String> {
    let mut build_command = app
        .shell()
        .command(node_bin)
        .args([
            tsx_cli_path.to_str().ok_or("Invalid tsx CLI path")?,
            script_path.to_str().ok_or("Invalid script path")?,
            "--source",
            source_path,
            "--output",
            db_path.to_str().ok_or("Invalid DB path")?,
            "--collection-id",
            collection_id,
            "--collection-name",
            collection_name,
            "--collection-icon",
            collection_icon,
        ])
        .current_dir(project_root);

    if let Some(api_key) = openai_api_key.filter(|k| !k.trim().is_empty()) {
        build_command = build_command.env("OPENAI_API_KEY", api_key);
    }

    let output = build_command
        .output()
        .await
        .map_err(|e| format!("Failed to spawn build process: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok(BuildCommandResult {
        success: output.status.success(),
        stderr,
    })
}

fn resolve_npm_cli_with_node(node_bin: &str) -> Option<String> {
    let script = "const r = require.resolve('npm/bin/npm-cli.js'); console.log(r);";
    std::process::Command::new(node_bin)
        .args(["-e", script])
        .output()
        .ok()
        .and_then(|out| {
            if !out.status.success() {
                return None;
            }
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if path.is_empty() {
                None
            } else {
                Some(path)
            }
        })
}

fn build_node_path_env(node_bin: &str) -> String {
    let mut parts: Vec<String> = Vec::new();

    if let Some(parent) = std::path::Path::new(node_bin)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
    {
        parts.push(parent);
    }

    for base in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
        parts.push(base.to_string());
    }

    if let Ok(existing) = std::env::var("PATH") {
        parts.push(existing);
    }

    parts.join(":")
}

async fn rebuild_better_sqlite3(
    app: &AppHandle,
    node_bin: &str,
    project_root: &std::path::Path,
) -> Result<(), String> {
    let mut attempts: Vec<(String, Vec<String>)> = Vec::new();
    let path_env = build_node_path_env(node_bin);

    // Best option in packaged environments: run npm CLI through resolved Node.
    if let Some(npm_cli) = resolve_npm_cli_with_node(node_bin) {
        attempts.push((
            node_bin.to_string(),
            vec![npm_cli, "rebuild".to_string(), "better-sqlite3".to_string()],
        ));
    }

    // Explicit npm CLI locations commonly used by Node installs.
    for npm_cli in [
        "/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
        "/usr/local/lib/node_modules/npm/bin/npm-cli.js",
        "/usr/lib/node_modules/npm/bin/npm-cli.js",
    ] {
        if std::path::Path::new(npm_cli).exists() {
            attempts.push((
                node_bin.to_string(),
                vec![
                    npm_cli.to_string(),
                    "rebuild".to_string(),
                    "better-sqlite3".to_string(),
                ],
            ));
        }
    }

    // Fallback: sibling npm next to the node executable.
    if let Some(parent) = std::path::Path::new(node_bin).parent() {
        let sibling_npm = parent.join("npm");
        attempts.push((
            sibling_npm.to_string_lossy().to_string(),
            vec!["rebuild".to_string(), "better-sqlite3".to_string()],
        ));
    }

    // Last resort PATH/common locations.
    for npm in [
        "npm",
        "/opt/homebrew/bin/npm",
        "/usr/local/bin/npm",
        "/usr/bin/npm",
    ] {
        attempts.push((
            npm.to_string(),
            vec!["rebuild".to_string(), "better-sqlite3".to_string()],
        ));
    }

    let mut errors = Vec::new();
    for (cmd, args) in attempts {
        let output = app
            .shell()
            .command(&cmd)
            .args(args.iter().map(String::as_str).collect::<Vec<_>>())
            .env("PATH", &path_env)
            .current_dir(project_root)
            .output()
            .await;

        match output {
            Ok(out) if out.status.success() => return Ok(()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                errors.push(format!(
                    "attempt '{}': {}",
                    cmd,
                    normalise_build_error(&stderr)
                ));
            }
            Err(e) => {
                errors.push(format!("attempt '{}': {}", cmd, e));
            }
        }
    }

    Err(format!(
        "Could not rebuild better-sqlite3 automatically. {}",
        errors.join(" | ")
    ))
}

async fn run_project_build(
    app: &AppHandle,
    stored_settings: &Settings,
    source_path: &str,
    db_path: &std::path::Path,
    collection_id: &str,
    collection_name: &str,
    collection_icon: &str,
) -> Result<(), String> {
    let project_root = resolve_project_root(app)?;
    let script_path = project_root.join("scripts/build-handbook.ts");
    let tsx_cli_path = project_root.join("node_modules/tsx/dist/cli.mjs");
    let node_bin = resolve_node_binary()
        .ok_or("Node.js executable not found. Install Node.js (v20+) to enable project imports.")?;

    if !tsx_cli_path.exists() {
        return Err(
            "Missing local tsx runtime at node_modules/tsx/dist/cli.mjs. Run `npm install` in the project checkout."
                .to_string(),
        );
    }

    let openai_api_key = stored_settings.openai_api_key.as_deref();
    let first = execute_project_build_command(
        app,
        &node_bin,
        &project_root,
        &tsx_cli_path,
        &script_path,
        source_path,
        db_path,
        collection_id,
        collection_name,
        collection_icon,
        openai_api_key,
    )
    .await?;

    if first.success {
        return Ok(());
    }

    if is_better_sqlite3_abi_mismatch(&first.stderr) {
        rebuild_better_sqlite3(app, &node_bin, &project_root).await?;
        let retry = execute_project_build_command(
            app,
            &node_bin,
            &project_root,
            &tsx_cli_path,
            &script_path,
            source_path,
            db_path,
            collection_id,
            collection_name,
            collection_icon,
            openai_api_key,
        )
        .await?;

        if retry.success {
            return Ok(());
        }

        return Err(format!(
            "Build failed after rebuilding better-sqlite3: {}",
            normalise_build_error(&retry.stderr)
        ));
    }

    Err(format!(
        "Build failed: {}",
        normalise_build_error(&first.stderr)
    ))
}

fn bookmark_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Bookmark> {
    let is_favorite_int: i64 = row.get(11)?;
    Ok(Bookmark {
        id: row.get(0)?,
        project_id: row.get(1)?,
        collection_id: row.get(2)?,
        doc_slug: row.get(3)?,
        anchor_id: row.get(4)?,
        title_snapshot: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        last_opened_at: row.get(8)?,
        order_index: row.get(9)?,
        open_count: row.get(10)?,
        is_favorite: is_favorite_int != 0,
    })
}

fn project_change_feed_from_row(
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<ProjectChangeFeedItem> {
    let changed_files_json: String = row.get(5)?;
    let changed_doc_slugs_json: String = row.get(6)?;
    let changed_files =
        serde_json::from_str::<Vec<String>>(&changed_files_json).unwrap_or_default();
    let changed_doc_slugs =
        serde_json::from_str::<Vec<String>>(&changed_doc_slugs_json).unwrap_or_default();
    Ok(ProjectChangeFeedItem {
        id: row.get(0)?,
        project_id: row.get(1)?,
        commit_hash: row.get(2)?,
        author: row.get(3)?,
        committed_at: row.get(4)?,
        changed_files,
        changed_doc_slugs,
        recorded_at: row.get(7)?,
    })
}

fn folder_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BookmarkFolder> {
    Ok(BookmarkFolder {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn tag_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<BookmarkTagEntity> {
    Ok(BookmarkTagEntity {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

#[tauri::command]
pub fn list_bookmark_folders(
    user_state: State<'_, UserStateDb>,
    project_id: String,
) -> Result<Vec<BookmarkFolder>, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, project_id, name, created_at, updated_at
             FROM bookmark_folders
             WHERE project_id = ?1
             ORDER BY name COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], folder_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_bookmark_folder(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    name: String,
) -> Result<BookmarkFolder, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO bookmark_folders (project_id, name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![project_id, trimmed, now, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, project_id, name, created_at, updated_at
         FROM bookmark_folders WHERE id = ?1",
        params![id],
        folder_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bookmark_folder(
    user_state: State<'_, UserStateDb>,
    folder_id: i64,
) -> Result<(), String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM bookmark_folders WHERE id = ?1",
        params![folder_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_bookmark_tags(
    user_state: State<'_, UserStateDb>,
    project_id: String,
) -> Result<Vec<BookmarkTagEntity>, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, project_id, name, created_at, updated_at
             FROM bookmark_tags
             WHERE project_id = ?1
             ORDER BY name COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], tag_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_bookmark_tag(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    name: String,
) -> Result<BookmarkTagEntity, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;

    let existing: Option<BookmarkTagEntity> = conn
        .query_row(
            "SELECT id, project_id, name, created_at, updated_at
             FROM bookmark_tags
             WHERE project_id = ?1 AND name = ?2
             LIMIT 1",
            params![&project_id, trimmed],
            tag_from_row,
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(tag) = existing {
        return Ok(tag);
    }

    conn.execute(
        "INSERT INTO bookmark_tags (project_id, name, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![project_id, trimmed, now, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, project_id, name, created_at, updated_at
         FROM bookmark_tags WHERE id = ?1",
        params![id],
        tag_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_bookmark_tag(user_state: State<'_, UserStateDb>, tag_id: i64) -> Result<(), String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM bookmark_tags WHERE id = ?1", params![tag_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_bookmark_relations(
    user_state: State<'_, UserStateDb>,
    project_id: String,
) -> Result<Vec<BookmarkRelations>, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;

    let mut bookmark_stmt = conn
        .prepare_cached("SELECT id FROM bookmarks WHERE project_id = ?1")
        .map_err(|e| e.to_string())?;
    let bookmark_ids = bookmark_stmt
        .query_map(params![&project_id], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut folder_stmt = conn
        .prepare_cached(
            "SELECT bfi.bookmark_id, bfi.folder_id
             FROM bookmark_folder_items bfi
             JOIN bookmarks b ON b.id = bfi.bookmark_id
             WHERE b.project_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let folder_pairs = folder_stmt
        .query_map(params![&project_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut tag_stmt = conn
        .prepare_cached(
            "SELECT bti.bookmark_id, bti.tag_id
             FROM bookmark_tag_items bti
             JOIN bookmarks b ON b.id = bti.bookmark_id
             WHERE b.project_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let tag_pairs = tag_stmt
        .query_map(params![&project_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut by_bookmark: std::collections::HashMap<i64, BookmarkRelations> = bookmark_ids
        .into_iter()
        .map(|id| {
            (
                id,
                BookmarkRelations {
                    bookmark_id: id,
                    folder_ids: vec![],
                    tag_ids: vec![],
                },
            )
        })
        .collect();

    for (bookmark_id, folder_id) in folder_pairs {
        if let Some(entry) = by_bookmark.get_mut(&bookmark_id) {
            entry.folder_ids.push(folder_id);
        }
    }

    for (bookmark_id, tag_id) in tag_pairs {
        if let Some(entry) = by_bookmark.get_mut(&bookmark_id) {
            entry.tag_ids.push(tag_id);
        }
    }

    Ok(by_bookmark.into_values().collect())
}

#[tauri::command]
pub fn bulk_delete_bookmarks(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    bookmark_ids: Vec<i64>,
) -> Result<i64, String> {
    if bookmark_ids.is_empty() {
        return Ok(0);
    }
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let mut deleted = 0;
    for bookmark_id in bookmark_ids {
        let affected = conn
            .execute(
                "DELETE FROM bookmarks WHERE id = ?1 AND project_id = ?2",
                params![bookmark_id, &project_id],
            )
            .map_err(|e| e.to_string())?;
        deleted += affected as i64;
    }
    Ok(deleted)
}

#[tauri::command]
pub fn bulk_set_bookmark_folder(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    bookmark_ids: Vec<i64>,
    folder_id: Option<i64>,
) -> Result<(), String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;

    if let Some(fid) = folder_id {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT id FROM bookmark_folders WHERE id = ?1 AND project_id = ?2 LIMIT 1",
                params![fid, &project_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if exists.is_none() {
            return Err("Folder does not exist for this project".to_string());
        }
    }

    for bookmark_id in bookmark_ids {
        conn.execute(
            "DELETE FROM bookmark_folder_items WHERE bookmark_id = ?1",
            params![bookmark_id],
        )
        .map_err(|e| e.to_string())?;

        if let Some(fid) = folder_id {
            let belongs_to_project: Option<i64> = conn
                .query_row(
                    "SELECT id FROM bookmarks WHERE id = ?1 AND project_id = ?2 LIMIT 1",
                    params![bookmark_id, &project_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            if belongs_to_project.is_some() {
                conn.execute(
                    "INSERT OR IGNORE INTO bookmark_folder_items (folder_id, bookmark_id)
                     VALUES (?1, ?2)",
                    params![fid, bookmark_id],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn bulk_set_bookmark_tags(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    bookmark_ids: Vec<i64>,
    tag_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;

    for tag_id in &tag_ids {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT id FROM bookmark_tags WHERE id = ?1 AND project_id = ?2 LIMIT 1",
                params![tag_id, &project_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if exists.is_none() {
            return Err(format!("Tag {} does not exist for this project", tag_id));
        }
    }

    for bookmark_id in bookmark_ids {
        conn.execute(
            "DELETE FROM bookmark_tag_items WHERE bookmark_id = ?1",
            params![bookmark_id],
        )
        .map_err(|e| e.to_string())?;

        let belongs_to_project: Option<i64> = conn
            .query_row(
                "SELECT id FROM bookmarks WHERE id = ?1 AND project_id = ?2 LIMIT 1",
                params![bookmark_id, &project_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if belongs_to_project.is_none() {
            continue;
        }

        for tag_id in &tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO bookmark_tag_items (tag_id, bookmark_id)
                 VALUES (?1, ?2)",
                params![tag_id, bookmark_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn highlight_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocHighlight> {
    Ok(DocHighlight {
        id: row.get(0)?,
        project_id: row.get(1)?,
        doc_slug: row.get(2)?,
        anchor_id: row.get(3)?,
        selected_text: row.get(4)?,
        context_text: row.get(5)?,
        created_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn get_doc_note(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
) -> Result<Option<DocNote>, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT project_id, doc_slug, note, updated_at
         FROM doc_notes
         WHERE project_id = ?1 AND doc_slug = ?2",
        params![project_id, doc_slug],
        |row| {
            Ok(DocNote {
                project_id: row.get(0)?,
                doc_slug: row.get(1)?,
                note: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_doc_note(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
    note: String,
) -> Result<DocNote, String> {
    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO doc_notes (project_id, doc_slug, note, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id, doc_slug)
         DO UPDATE SET note = excluded.note, updated_at = excluded.updated_at",
        params![&project_id, &doc_slug, &note, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(DocNote {
        project_id,
        doc_slug,
        note,
        updated_at: now,
    })
}

#[tauri::command]
pub fn list_doc_highlights(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
) -> Result<Vec<DocHighlight>, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, project_id, doc_slug, anchor_id, selected_text, context_text, created_at
             FROM doc_highlights
             WHERE project_id = ?1 AND doc_slug = ?2
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id, doc_slug], highlight_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_doc_highlight(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
    anchor_id: Option<String>,
    selected_text: String,
    context_text: Option<String>,
) -> Result<DocHighlight, String> {
    let text = selected_text.trim();
    if text.is_empty() {
        return Err("Highlight text cannot be empty".to_string());
    }

    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO doc_highlights (project_id, doc_slug, anchor_id, selected_text, context_text, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![project_id, doc_slug, anchor_id, text, context_text, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, project_id, doc_slug, anchor_id, selected_text, context_text, created_at
         FROM doc_highlights WHERE id = ?1",
        params![id],
        highlight_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_doc_highlight(user_state: State<'_, UserStateDb>, id: i64) -> Result<(), String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM doc_highlights WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_bookmarks(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    query: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<Bookmark>, String> {
    let limit = limit.unwrap_or(200).clamp(1, 5000);
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let has_query = query
        .as_ref()
        .map(|q| !q.trim().is_empty())
        .unwrap_or(false);

    let sql = if has_query {
        "SELECT id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index, open_count, is_favorite \
         FROM bookmarks \
         WHERE project_id = ?1 AND title_snapshot LIKE ?2 \
         ORDER BY is_favorite DESC, open_count DESC, COALESCE(last_opened_at, updated_at) DESC, created_at DESC \
         LIMIT ?3"
    } else {
        "SELECT id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index, open_count, is_favorite \
         FROM bookmarks \
         WHERE project_id = ?1 \
         ORDER BY is_favorite DESC, open_count DESC, COALESCE(last_opened_at, updated_at) DESC, created_at DESC \
         LIMIT ?2"
    };

    let mut stmt = conn.prepare_cached(sql).map_err(|e| e.to_string())?;

    let rows = if has_query {
        let search = format!("%{}%", query.unwrap_or_default().trim());
        stmt.query_map(params![project_id, search, limit], bookmark_from_row)
            .map_err(|e| e.to_string())?
    } else {
        stmt.query_map(params![project_id, limit], bookmark_from_row)
            .map_err(|e| e.to_string())?
    };

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_bookmark(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    collection_id: String,
    doc_slug: String,
    anchor_id: Option<String>,
    title_snapshot: String,
) -> Result<Bookmark, String> {
    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;

    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM bookmarks \
             WHERE project_id = ?1 AND doc_slug = ?2 \
             AND ((anchor_id IS NULL AND ?3 IS NULL) OR anchor_id = ?3) \
             LIMIT 1",
            params![&project_id, &doc_slug, &anchor_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let bookmark_id = if let Some(id) = existing_id {
        conn.execute(
            "UPDATE bookmarks \
             SET collection_id = ?1, title_snapshot = ?2, updated_at = ?3 \
             WHERE id = ?4",
            params![&collection_id, &title_snapshot, now, id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO bookmark_events (bookmark_id, event_type, created_at) VALUES (?1, 'updated', ?2)",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
        id
    } else {
        let next_order_index: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(order_index), 0) + 1 FROM bookmarks WHERE project_id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO bookmarks (
                project_id, collection_id, doc_slug, anchor_id, title_snapshot,
                created_at, updated_at, last_opened_at, order_index, open_count, is_favorite
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, 0, 0)",
            params![
                &project_id,
                &collection_id,
                &doc_slug,
                &anchor_id,
                &title_snapshot,
                now,
                now,
                next_order_index
            ],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO bookmark_events (bookmark_id, event_type, created_at) VALUES (?1, 'created', ?2)",
            params![id, now],
        )
        .map_err(|e| e.to_string())?;
        id
    };

    conn.query_row(
        "SELECT id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index, open_count, is_favorite \
         FROM bookmarks WHERE id = ?1",
        params![bookmark_id],
        bookmark_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_bookmark(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
    anchor_id: Option<String>,
) -> Result<bool, String> {
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let removed = conn
        .execute(
            "DELETE FROM bookmarks \
             WHERE project_id = ?1 AND doc_slug = ?2 \
             AND ((anchor_id IS NULL AND ?3 IS NULL) OR anchor_id = ?3)",
            params![project_id, doc_slug, anchor_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(removed > 0)
}

#[tauri::command]
pub fn repair_bookmark_target(
    user_state: State<'_, UserStateDb>,
    bookmark_id: i64,
    collection_id: String,
    doc_slug: String,
    anchor_id: Option<String>,
    title_snapshot: String,
) -> Result<Bookmark, String> {
    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE bookmarks
         SET collection_id = ?1, doc_slug = ?2, anchor_id = ?3, title_snapshot = ?4, updated_at = ?5
         WHERE id = ?6",
        params![
            collection_id,
            doc_slug,
            anchor_id,
            title_snapshot,
            now,
            bookmark_id
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO bookmark_events (bookmark_id, event_type, created_at) VALUES (?1, 'repaired', ?2)",
        params![bookmark_id, now],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index, open_count, is_favorite
         FROM bookmarks WHERE id = ?1",
        params![bookmark_id],
        bookmark_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn touch_bookmark_opened(
    user_state: State<'_, UserStateDb>,
    bookmark_id: i64,
) -> Result<(), String> {
    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE bookmarks
         SET last_opened_at = ?1, updated_at = ?1, open_count = open_count + 1
         WHERE id = ?2",
        params![now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO bookmark_events (bookmark_id, event_type, created_at) VALUES (?1, 'opened', ?2)",
        params![bookmark_id, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_bookmark_favorite(
    user_state: State<'_, UserStateDb>,
    bookmark_id: i64,
    is_favorite: bool,
) -> Result<Bookmark, String> {
    let now = unix_timestamp_i64();
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE bookmarks
         SET is_favorite = ?1, updated_at = ?2
         WHERE id = ?3",
        params![if is_favorite { 1 } else { 0 }, now, bookmark_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO bookmark_events (bookmark_id, event_type, created_at)
         VALUES (?1, ?2, ?3)",
        params![
            bookmark_id,
            if is_favorite {
                "favorited"
            } else {
                "unfavorited"
            },
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, project_id, collection_id, doc_slug, anchor_id, title_snapshot, created_at, updated_at, last_opened_at, order_index, open_count, is_favorite
         FROM bookmarks WHERE id = ?1",
        params![bookmark_id],
        bookmark_from_row,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_document_viewed(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    doc_slug: String,
    viewed_at: Option<i64>,
) -> Result<(), String> {
    let at = viewed_at.unwrap_or_else(unix_timestamp_i64);
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO doc_views (project_id, doc_slug, last_viewed_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(project_id, doc_slug)
         DO UPDATE SET last_viewed_at = excluded.last_viewed_at",
        params![project_id, doc_slug, at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_modified_epoch(
    project_conn: &rusqlite::Connection,
    last_modified: Option<&str>,
) -> Option<i64> {
    let modified = last_modified?;
    project_conn
        .query_row(
            "SELECT CAST(strftime('%s', ?1) AS INTEGER)",
            params![modified],
            |row| row.get::<_, Option<i64>>(0),
        )
        .ok()
        .flatten()
}

fn is_updated_since_viewed(
    project_conn: &rusqlite::Connection,
    last_modified: Option<&str>,
    last_viewed_at: Option<i64>,
) -> bool {
    let modified_epoch = match parse_modified_epoch(project_conn, last_modified) {
        Some(epoch) => epoch,
        None => return false,
    };
    match last_viewed_at {
        Some(viewed) => modified_epoch > viewed,
        None => true,
    }
}

#[tauri::command]
pub fn get_recent_documents(
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    user_state: State<'_, UserStateDb>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<DocActivityItem>, String> {
    let limit = limit.unwrap_or(10).clamp(1, 100) as usize;

    let viewed_docs: Vec<(String, i64)> = {
        let user_conn = user_state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = user_conn
            .prepare_cached(
                "SELECT doc_slug, last_viewed_at
                 FROM doc_views
                 WHERE project_id = ?1
                 ORDER BY last_viewed_at DESC
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![&project_id, limit as i32], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    if viewed_docs.is_empty() {
        return Ok(vec![]);
    }

    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let project_conn = mgr.connection(&project_id)?;

    let mut out = Vec::with_capacity(viewed_docs.len());
    for (doc_slug, last_viewed_at) in viewed_docs {
        let doc = project_conn
            .query_row(
                "SELECT collection_id, title, section, last_modified
                 FROM documents
                 WHERE slug = ?1",
                params![&doc_slug],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;

        if let Some((collection_id, title, section, last_modified)) = doc {
            let updated_since_viewed = is_updated_since_viewed(
                project_conn,
                last_modified.as_deref(),
                Some(last_viewed_at),
            );
            out.push(DocActivityItem {
                doc_slug,
                collection_id,
                title,
                section,
                last_modified,
                last_viewed_at: Some(last_viewed_at),
                updated_since_viewed,
            });
        }
    }

    Ok(out)
}

#[tauri::command]
pub fn get_updated_documents(
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    user_state: State<'_, UserStateDb>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<DocActivityItem>, String> {
    let limit = limit.unwrap_or(20).clamp(1, 200) as usize;

    let viewed_map = {
        let user_conn = user_state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = user_conn
            .prepare_cached(
                "SELECT doc_slug, last_viewed_at
                 FROM doc_views
                 WHERE project_id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![&project_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<std::collections::HashMap<_, _>, _>>()
            .map_err(|e| e.to_string())?
    };

    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let project_conn = mgr.connection(&project_id)?;

    let mut stmt = project_conn
        .prepare_cached(
            "SELECT slug, collection_id, title, section, last_modified
             FROM documents
             WHERE last_modified IS NOT NULL
             ORDER BY last_modified DESC
             LIMIT 1000",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(limit);
    for row in rows {
        let (doc_slug, collection_id, title, section, last_modified) =
            row.map_err(|e| e.to_string())?;
        let last_viewed_at = viewed_map.get(&doc_slug).copied();
        let updated_since_viewed =
            is_updated_since_viewed(project_conn, last_modified.as_deref(), last_viewed_at);

        if updated_since_viewed {
            out.push(DocActivityItem {
                doc_slug,
                collection_id,
                title,
                section,
                last_modified,
                last_viewed_at,
                updated_since_viewed,
            });
            if out.len() >= limit {
                break;
            }
        }
    }

    Ok(out)
}

#[tauri::command]
pub fn get_project_change_feed(
    user_state: State<'_, UserStateDb>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<ProjectChangeFeedItem>, String> {
    let limit = limit.unwrap_or(20).clamp(1, 200);
    let conn = user_state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, project_id, commit_hash, author, committed_at, changed_files_json, changed_doc_slugs_json, recorded_at
             FROM project_change_feed
             WHERE project_id = ?1
             ORDER BY recorded_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id, limit], project_change_feed_from_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn map_changed_paths_to_doc_slugs(
    conn: &rusqlite::Connection,
    source_relative_prefix: &str,
    changed_files: &[String],
) -> Result<Vec<String>, String> {
    let mut slugs = std::collections::BTreeSet::new();
    let prefix = if source_relative_prefix == "." || source_relative_prefix.is_empty() {
        String::new()
    } else {
        format!("{}/", source_relative_prefix.trim_matches('/'))
    };

    for changed in changed_files {
        if !changed.to_ascii_lowercase().ends_with(".md") {
            continue;
        }
        let relative_doc_path = if prefix.is_empty() {
            changed.clone()
        } else if changed.starts_with(&prefix) {
            changed[prefix.len()..].to_string()
        } else {
            continue;
        };
        let slug: Option<String> = conn
            .query_row(
                "SELECT slug FROM documents WHERE path = ?1 LIMIT 1",
                params![relative_doc_path],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(doc_slug) = slug {
            slugs.insert(doc_slug);
        }
    }

    Ok(slugs.into_iter().collect())
}

fn capture_git_change_feed_entry(
    project_conn: &rusqlite::Connection,
    source_path: &str,
) -> Option<(String, String, String, Vec<String>, Vec<String>)> {
    let show_toplevel = std::process::Command::new("git")
        .args(["-C", source_path, "rev-parse", "--show-toplevel"])
        .output()
        .ok()?;
    if !show_toplevel.status.success() {
        return None;
    }
    let repo_root = String::from_utf8_lossy(&show_toplevel.stdout)
        .trim()
        .to_string();
    if repo_root.is_empty() {
        return None;
    }

    let prefix_out = std::process::Command::new("git")
        .args(["-C", source_path, "rev-parse", "--show-prefix"])
        .output()
        .ok()?;
    if !prefix_out.status.success() {
        return None;
    }
    let source_prefix = String::from_utf8_lossy(&prefix_out.stdout)
        .trim()
        .trim_end_matches('/')
        .to_string();

    let meta_out = std::process::Command::new("git")
        .args([
            "-C",
            source_path,
            "log",
            "-1",
            "--pretty=format:%H%n%an%n%aI",
        ])
        .output()
        .ok()?;
    if !meta_out.status.success() {
        return None;
    }
    let meta_text = String::from_utf8_lossy(&meta_out.stdout);
    let mut meta_lines = meta_text.lines();
    let commit_hash = meta_lines.next()?.trim().to_string();
    let author = meta_lines.next()?.trim().to_string();
    let committed_at = meta_lines.next()?.trim().to_string();

    if commit_hash.is_empty() {
        return None;
    }

    let files_out = std::process::Command::new("git")
        .args([
            "-C",
            source_path,
            "show",
            "--name-only",
            "--pretty=format:",
            &commit_hash,
        ])
        .output()
        .ok()?;
    if !files_out.status.success() {
        return None;
    }
    let changed_files: Vec<String> = String::from_utf8_lossy(&files_out.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(|line| line.to_string())
        .collect();

    let changed_doc_slugs =
        map_changed_paths_to_doc_slugs(project_conn, &source_prefix, &changed_files).ok()?;

    if repo_root.is_empty() {
        return None;
    }

    Some((
        commit_hash,
        author,
        committed_at,
        changed_files,
        changed_doc_slugs,
    ))
}

fn record_project_change_feed(
    user_state_conn: &rusqlite::Connection,
    project_conn: &rusqlite::Connection,
    project_id: &str,
    source_path: &str,
) -> Result<(), String> {
    let Some((commit_hash, author, committed_at, changed_files, changed_doc_slugs)) =
        capture_git_change_feed_entry(project_conn, source_path)
    else {
        return Ok(());
    };

    let already_exists: Option<i64> = user_state_conn
        .query_row(
            "SELECT id FROM project_change_feed WHERE project_id = ?1 AND commit_hash = ?2 LIMIT 1",
            params![project_id, &commit_hash],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if already_exists.is_some() {
        return Ok(());
    }

    let changed_files_json = serde_json::to_string(&changed_files).map_err(|e| e.to_string())?;
    let changed_doc_slugs_json =
        serde_json::to_string(&changed_doc_slugs).map_err(|e| e.to_string())?;
    let now = unix_timestamp_i64();

    user_state_conn
        .execute(
            "INSERT INTO project_change_feed (
                project_id, commit_hash, author, committed_at,
                changed_files_json, changed_doc_slugs_json, recorded_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                project_id,
                commit_hash,
                author,
                committed_at,
                changed_files_json,
                changed_doc_slugs_json,
                now
            ],
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Note: Mutex poisoning is mitigated by panic = "abort" in release profile.
// rusqlite::Connection is not Sync, so Mutex is required over RwLock.
#[tauri::command]
pub fn get_collections(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
) -> Result<Vec<Collection>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, name, icon, description, sort_order FROM collections ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;
    let results = stmt
        .query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                description: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    results
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_navigation(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    collection_id: String,
) -> Result<Vec<NavigationNode>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT id, collection_id, slug, parent_slug, title, sort_order, level, has_children \
             FROM navigation_tree \
             WHERE collection_id = ? \
             ORDER BY level, sort_order",
        )
        .map_err(|e| e.to_string())?;
    let results = stmt
        .query_map([&collection_id], |row| {
            let has_children_int: i32 = row.get(7)?;
            Ok(NavigationNode {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                slug: row.get(2)?,
                parent_slug: row.get(3)?,
                title: row.get(4)?,
                sort_order: row.get(5)?,
                level: row.get(6)?,
                has_children: has_children_int != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    results
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_document(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    slug: String,
) -> Result<Document, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    conn.query_row(
        "SELECT id, collection_id, slug, title, section, sort_order, parent_slug, \
         content_html, path, last_modified \
         FROM documents WHERE slug = ?",
        [&slug],
        |row| {
            Ok(Document {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                slug: row.get(2)?,
                title: row.get(3)?,
                section: row.get(4)?,
                sort_order: row.get(5)?,
                parent_slug: row.get(6)?,
                content_html: row.get(7)?,
                path: row.get(8)?,
                last_modified: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_documents(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    query: String,
    collection_id: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    let limit = limit.unwrap_or(20);

    let sanitised_query = ai::sanitise_fts5_query(&query);
    if sanitised_query.is_empty() {
        return Ok(vec![]);
    }

    let results = if let Some(ref cid) = collection_id {
        let mut stmt = conn
            .prepare_cached(
                "SELECT d.slug, d.title, d.section, d.collection_id, \
                 snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet \
                 FROM documents_fts \
                 JOIN documents d ON d.id = documents_fts.rowid \
                 WHERE documents_fts MATCH ? AND d.collection_id = ? \
                 ORDER BY rank \
                 LIMIT ?",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![&sanitised_query, cid, limit], |row| {
                Ok(SearchResult {
                    slug: row.get(0)?,
                    title: row.get(1)?,
                    section: row.get(2)?,
                    collection_id: row.get(3)?,
                    snippet: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare_cached(
                "SELECT d.slug, d.title, d.section, d.collection_id, \
                 snippet(documents_fts, 1, '<mark>', '</mark>', '...', 30) as snippet \
                 FROM documents_fts \
                 JOIN documents d ON d.id = documents_fts.rowid \
                 WHERE documents_fts MATCH ? \
                 ORDER BY rank \
                 LIMIT ?",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![&sanitised_query, limit], |row| {
                Ok(SearchResult {
                    slug: row.get(0)?,
                    title: row.get(1)?,
                    section: row.get(2)?,
                    collection_id: row.get(3)?,
                    snippet: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    };

    results
}

#[tauri::command]
pub fn get_tags(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    collection_id: Option<String>,
) -> Result<Vec<Tag>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;

    let results = if let Some(ref cid) = collection_id {
        let mut stmt = conn
            .prepare_cached(
                "SELECT t.tag, COUNT(dt.document_id) as count \
                 FROM tags t \
                 JOIN document_tags dt ON dt.tag_id = t.id \
                 JOIN documents d ON d.id = dt.document_id \
                 WHERE d.collection_id = ? \
                 GROUP BY t.tag \
                 ORDER BY count DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([cid], |row| {
                Ok(Tag {
                    tag: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    } else {
        let mut stmt = conn
            .prepare_cached(
                "SELECT t.tag, COUNT(dt.document_id) as count \
                 FROM tags t \
                 JOIN document_tags dt ON dt.tag_id = t.id \
                 JOIN documents d ON d.id = dt.document_id \
                 GROUP BY t.tag \
                 ORDER BY count DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Tag {
                    tag: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    };

    results
}

#[tauri::command]
pub fn get_documents_by_tag(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    tag: String,
) -> Result<Vec<SearchResult>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    let mut stmt = conn
        .prepare_cached(
            "SELECT d.slug, d.title, d.section, d.collection_id, '' as snippet \
             FROM documents d \
             JOIN document_tags dt ON d.id = dt.document_id \
             JOIN tags t ON t.id = dt.tag_id \
             WHERE t.tag = ? \
             ORDER BY d.title",
        )
        .map_err(|e| e.to_string())?;
    let results = stmt
        .query_map([&tag], |row| {
            Ok(SearchResult {
                slug: row.get(0)?,
                title: row.get(1)?,
                section: row.get(2)?,
                collection_id: row.get(3)?,
                snippet: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    results
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_similar_chunks(
    manager: State<'_, std::sync::Mutex<crate::projects::ProjectManager>>,
    query_embedding: Vec<f32>,
    limit: Option<usize>,
) -> Result<Vec<ScoredChunk>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let conn = mgr.active_connection()?;
    let limit = limit.unwrap_or(10);
    ai::vector_search(&conn, &query_embedding, limit)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let stored = settings::load_settings(&app)?;
    Ok(settings::mask_settings(&stored))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, new_settings: Settings) -> Result<(), String> {
    // When saving, if a key looks masked (contains "..."), keep the existing key
    let existing = settings::load_settings(&app).unwrap_or_default();

    let merged = Settings {
        openai_api_key: merge_key(&new_settings.openai_api_key, &existing.openai_api_key),
        anthropic_api_key: merge_key(&new_settings.anthropic_api_key, &existing.anthropic_api_key),
        gemini_api_key: merge_key(&new_settings.gemini_api_key, &existing.gemini_api_key),
        ollama_base_url: new_settings.ollama_base_url,
        preferred_provider: new_settings.preferred_provider,
        anthropic_model: new_settings.anthropic_model,
        gemini_model: new_settings.gemini_model,
    };

    settings::save_settings_to_store(&app, &merged)
}

/// If the incoming key matches the masked format (prefix...suffix), keep the existing key.
fn merge_key(incoming: &Option<String>, existing: &Option<String>) -> Option<String> {
    match incoming {
        Some(k) if is_masked_key(k) => existing.clone(),
        Some(k) if k.is_empty() => None,
        other => other.clone(),
    }
}

/// Check whether a string matches the output format of `mask_key`:
/// either all asterisks (short keys) or chars...chars (longer keys).
fn is_masked_key(value: &str) -> bool {
    // All asterisks — masked short key
    if !value.is_empty() && value.chars().all(|c| c == '*') {
        return true;
    }
    // Pattern: <prefix>...<suffix> where prefix and suffix are non-empty
    if let Some(dot_pos) = value.find("...") {
        let prefix = &value[..dot_pos];
        let suffix = &value[dot_pos + 3..];
        return !prefix.is_empty() && !suffix.is_empty();
    }
    false
}

#[tauri::command]
pub async fn test_provider(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    provider: AiProvider,
) -> Result<String, String> {
    let stored = settings::load_settings(&app)?;
    ai::test_provider_connection(&http_client.0, &stored, &provider).await
}

fn has_non_empty(value: &Option<String>) -> bool {
    value
        .as_ref()
        .map(|v| !v.trim().is_empty())
        .unwrap_or(false)
}

fn provider_is_configured(settings: &Settings, provider: &AiProvider) -> bool {
    match provider {
        AiProvider::Openai => has_non_empty(&settings.openai_api_key),
        AiProvider::Anthropic => has_non_empty(&settings.anthropic_api_key),
        AiProvider::Gemini => has_non_empty(&settings.gemini_api_key),
        AiProvider::Ollama => has_non_empty(&settings.ollama_base_url),
    }
}

fn resolve_provider(
    settings: &Settings,
    provider: Option<AiProvider>,
) -> Result<AiProvider, String> {
    if let Some(explicit) = provider {
        if provider_is_configured(settings, &explicit) {
            return Ok(explicit);
        }
        return Err(match explicit {
            AiProvider::Openai => {
                "OpenAI is selected but no OpenAI API key is configured.".to_string()
            }
            AiProvider::Anthropic => {
                "Anthropic is selected but no Anthropic API key is configured.".to_string()
            }
            AiProvider::Gemini => {
                "Gemini is selected but no Gemini API key is configured.".to_string()
            }
            AiProvider::Ollama => {
                "Ollama is selected but no Ollama base URL is configured.".to_string()
            }
        });
    }

    if let Some(preferred) = settings.preferred_provider.as_ref().and_then(|p| {
        serde_json::from_value::<AiProvider>(serde_json::Value::String(p.clone())).ok()
    }) {
        if provider_is_configured(settings, &preferred) {
            return Ok(preferred);
        }
    }

    for candidate in [
        AiProvider::Openai,
        AiProvider::Anthropic,
        AiProvider::Gemini,
        AiProvider::Ollama,
    ] {
        if provider_is_configured(settings, &candidate) {
            return Ok(candidate);
        }
    }

    Err("No AI provider is configured. Add an OpenAI, Anthropic, or Gemini API key, or configure an Ollama base URL in Settings.".to_string())
}

#[tauri::command]
pub async fn ask_question(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    question: String,
    request_id: String,
    provider: Option<AiProvider>,
) -> Result<(), String> {
    let stored = settings::load_settings(&app)?;

    let provider = resolve_provider(&stored, provider)?;

    // Run the RAG pipeline — errors are emitted as events
    if let Err(e) = ai::ask_question_rag(
        http_client.0.clone(),
        app.clone(),
        request_id.clone(),
        question,
        provider,
    )
    .await
    {
        if let Err(emit_err) =
            tauri::Emitter::emit(&app, "ai-response-error", ai::error_event(&request_id, &e))
        {
            eprintln!(
                "Warning: failed to emit ai-response-error event: {}. Original error: {}",
                emit_err, e
            );
        }
        return Err(e);
    }

    Ok(())
}

#[tauri::command]
pub async fn get_embedding(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    text: String,
    provider: Option<AiProvider>,
) -> Result<Vec<f32>, String> {
    let stored = settings::load_settings(&app)?;
    let provider = resolve_provider(&stored, provider)?;

    ai::generate_embedding(&http_client.0, &stored, &provider, &text).await
}

#[tauri::command]
pub fn cancel_ai_request(request_id: String) -> Result<(), String> {
    ai::cancel_request(&request_id)
}

#[tauri::command]
pub fn list_projects(
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
) -> Result<Vec<crate::projects::Project>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.registry.projects.clone())
}

#[tauri::command]
pub fn get_active_project_id(
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
) -> Result<String, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.registry.active_project_id.clone())
}

#[tauri::command]
pub fn set_active_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    project_id: String,
) -> Result<(), String> {
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.set_active_project(&project_id)?;
    crate::projects::save_registry(&app, &mgr.registry)?;
    Ok(())
}

#[tauri::command]
pub async fn add_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    user_state: State<'_, UserStateDb>,
    name: String,
    icon: String,
    source_path: String,
) -> Result<crate::projects::Project, String> {
    let stored_settings = settings::load_settings(&app).unwrap_or_default();

    // Generate a slug ID from the name
    let id = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    // Determine output DB path in app data directory
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let projects_dir = app_data_dir.join("projects");
    std::fs::create_dir_all(&projects_dir).map_err(|e| e.to_string())?;
    let db_path = projects_dir.join(format!("{}.db", id));

    // Emit build started event
    let _ = app.emit(
        "project-build-started",
        serde_json::json!({ "projectId": &id }),
    );

    if let Err(build_err) = run_project_build(
        &app,
        &stored_settings,
        &source_path,
        &db_path,
        &id,
        &name,
        &icon,
    )
    .await
    {
        let _ = app.emit(
            "project-build-error",
            serde_json::json!({ "projectId": &id, "error": build_err.clone() }),
        );
        return Err(build_err);
    }

    let _ = app.emit(
        "project-build-complete",
        serde_json::json!({ "projectId": &id }),
    );

    // Create the project entry
    let project = crate::projects::Project {
        id: id.clone(),
        name: name.clone(),
        icon,
        built_in: false,
        source_path: Some(source_path.clone()),
        db_path: Some(format!("projects/{}.db", id)),
        last_built: Some(unix_timestamp()),
        collections: vec![],
    };

    // Register in ProjectManager
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.open_connection(&id, &db_path)?;
    if let Some(project_conn) = mgr.connections.get(&id) {
        if let Ok(user_state_conn) = user_state.0.lock() {
            let _ = record_project_change_feed(&user_state_conn, project_conn, &id, &source_path);
        }
    }
    mgr.add_project(project.clone());
    crate::projects::save_registry(&app, &mgr.registry)?;

    Ok(project)
}

#[tauri::command]
pub async fn rebuild_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    user_state: State<'_, UserStateDb>,
    project_id: String,
) -> Result<(), String> {
    let stored_settings = settings::load_settings(&app).unwrap_or_default();

    // Get project details
    let (source_path, db_relative_path, name, icon) = {
        let mgr = manager.lock().map_err(|e| e.to_string())?;
        let project = mgr
            .registry
            .projects
            .iter()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        if project.built_in {
            return Err("Cannot rebuild built-in project".to_string());
        }

        (
            project
                .source_path
                .clone()
                .ok_or("No source path for project")?,
            project
                .db_path
                .clone()
                .ok_or("No database path for project")?,
            project.name.clone(),
            project.icon.clone(),
        )
    };

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join(&db_relative_path);

    // Keep the old connection alive during the build so queries still work.
    // We only swap it out after the new database is ready.

    let _ = app.emit(
        "project-build-started",
        serde_json::json!({ "projectId": &project_id }),
    );

    if let Err(build_err) = run_project_build(
        &app,
        &stored_settings,
        &source_path,
        &db_path,
        &project_id,
        &name,
        &icon,
    )
    .await
    {
        let _ = app.emit(
            "project-build-error",
            serde_json::json!({ "projectId": &project_id, "error": build_err.clone() }),
        );
        return Err(build_err);
    }

    // Build succeeded — close old connection and open new one in a single lock
    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.close_connection(&project_id);
        mgr.open_connection(&project_id, &db_path)?;

        // Update last_built timestamp
        if let Some(project) = mgr
            .registry
            .projects
            .iter_mut()
            .find(|p| p.id == project_id)
        {
            project.last_built = Some(unix_timestamp());
        }
        if let Some(project_conn) = mgr.connections.get(&project_id) {
            if let Ok(user_state_conn) = user_state.0.lock() {
                let _ = record_project_change_feed(
                    &user_state_conn,
                    project_conn,
                    &project_id,
                    &source_path,
                );
            }
        }
        crate::projects::save_registry(&app, &mgr.registry)?;
    }

    let _ = app.emit(
        "project-build-complete",
        serde_json::json!({ "projectId": &project_id }),
    );

    Ok(())
}

#[tauri::command]
pub async fn remove_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    user_state: State<'_, UserStateDb>,
    project_id: String,
) -> Result<(), String> {
    let db_relative_path = {
        let mgr = manager.lock().map_err(|e| e.to_string())?;
        let project = mgr
            .registry
            .projects
            .iter()
            .find(|p| p.id == project_id)
            .ok_or_else(|| format!("Project '{}' not found", project_id))?;

        if project.built_in {
            return Err("Cannot remove built-in project".to_string());
        }

        project.db_path.clone()
    };

    // Remove from manager (closes connection, removes from registry)
    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.remove_project(&project_id)?;
        crate::projects::save_registry(&app, &mgr.registry)?;
    }

    // Delete the database file
    if let Some(relative_path) = db_relative_path {
        let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let db_path = app_data_dir.join(&relative_path);
        if db_path.exists() {
            std::fs::remove_file(&db_path).map_err(|e| e.to_string())?;
        }
    }

    // Remove per-project user state
    {
        let conn = user_state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM doc_views WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM doc_notes WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM doc_highlights WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM project_change_feed WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM bookmarks WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM bookmark_folders WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM bookmark_tags WHERE project_id = ?1",
            params![&project_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
