use crate::ai;
use crate::db::HttpClient;
use crate::models::*;
use crate::projects::ProjectManager;
use crate::settings;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::ShellExt;

fn unix_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default()
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
        anthropic_api_key: merge_key(
            &new_settings.anthropic_api_key,
            &existing.anthropic_api_key,
        ),
        ollama_base_url: new_settings.ollama_base_url,
        preferred_provider: new_settings.preferred_provider,
        anthropic_model: new_settings.anthropic_model,
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
pub async fn test_provider(app: AppHandle, http_client: State<'_, HttpClient>, provider: AiProvider) -> Result<String, String> {
    let stored = settings::load_settings(&app)?;
    ai::test_provider_connection(&http_client.0, &stored, &provider).await
}

#[tauri::command]
pub async fn ask_question(
    app: AppHandle,
    http_client: State<'_, HttpClient>,
    question: String,
    provider: Option<AiProvider>,
) -> Result<(), String> {
    let stored = settings::load_settings(&app)?;

    // Determine the provider to use
    let provider = provider
        .or_else(|| {
            stored
                .preferred_provider
                .as_ref()
                .and_then(|p| {
                    match serde_json::from_value::<AiProvider>(serde_json::Value::String(p.clone())) {
                        Ok(provider) => Some(provider),
                        Err(e) => {
                            eprintln!("Warning: invalid preferred_provider value '{}': {}", p, e);
                            None
                        }
                    }
                })
        })
        .unwrap_or_else(|| {
            // Auto-detect: prefer OpenAI if key set, then Anthropic, then Ollama
            if stored.openai_api_key.is_some() {
                AiProvider::Openai
            } else if stored.anthropic_api_key.is_some() {
                AiProvider::Anthropic
            } else {
                AiProvider::Ollama
            }
        });

    // Run the RAG pipeline — errors are emitted as events
    if let Err(e) = ai::ask_question_rag(http_client.0.clone(), app.clone(), question, provider).await {
        if let Err(emit_err) = tauri::Emitter::emit(&app, "ai-response-error", &e) {
            eprintln!("Warning: failed to emit ai-response-error event: {}. Original error: {}", emit_err, e);
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

    let provider = provider.unwrap_or_else(|| {
        if stored.openai_api_key.is_some() {
            AiProvider::Openai
        } else {
            AiProvider::Ollama
        }
    });

    ai::generate_embedding(&http_client.0, &stored, &provider, &text).await
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
    name: String,
    icon: String,
    source_path: String,
) -> Result<crate::projects::Project, String> {
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
    let _ = app.emit("project-build-started", serde_json::json!({ "projectId": &id }));

    // Resolve project root (parent of src-tauri/)
    let project_root = {
        let mut path = std::env::current_dir().map_err(|e| e.to_string())?;
        if path.ends_with("src-tauri") {
            path.pop();
        }
        path
    };
    let script_path = project_root.join("scripts/build-handbook.ts");

    // Spawn the build script using npx tsx
    let output = app
        .shell()
        .command("npx")
        .args([
            "tsx",
            script_path.to_str().ok_or("Invalid script path")?,
            "--source",
            &source_path,
            "--output",
            db_path.to_str().ok_or("Invalid DB path")?,
            "--collection-id",
            &id,
            "--collection-name",
            &name,
            "--collection-icon",
            &icon,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn build process: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = app.emit(
            "project-build-error",
            serde_json::json!({ "projectId": &id, "error": stderr.to_string() }),
        );
        return Err(format!("Build failed: {}", stderr));
    }

    let _ = app.emit("project-build-complete", serde_json::json!({ "projectId": &id }));

    // Create the project entry
    let project = crate::projects::Project {
        id: id.clone(),
        name: name.clone(),
        icon,
        built_in: false,
        source_path: Some(source_path),
        db_path: Some(format!("projects/{}.db", id)),
        last_built: Some(unix_timestamp()),
        collections: vec![],
    };

    // Register in ProjectManager
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    mgr.open_connection(&id, &db_path)?;
    mgr.add_project(project.clone());
    crate::projects::save_registry(&app, &mgr.registry)?;

    Ok(project)
}

#[tauri::command]
pub async fn rebuild_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
    project_id: String,
) -> Result<(), String> {
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
            project.source_path.clone().ok_or("No source path for project")?,
            project.db_path.clone().ok_or("No database path for project")?,
            project.name.clone(),
            project.icon.clone(),
        )
    };

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join(&db_relative_path);

    // Close existing connection before rebuild
    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.close_connection(&project_id);
    }

    let _ = app.emit("project-build-started", serde_json::json!({ "projectId": &project_id }));

    // Resolve project root (parent of src-tauri/)
    let project_root = {
        let mut path = std::env::current_dir().map_err(|e| e.to_string())?;
        if path.ends_with("src-tauri") {
            path.pop();
        }
        path
    };
    let script_path = project_root.join("scripts/build-handbook.ts");

    let output = app
        .shell()
        .command("npx")
        .args([
            "tsx",
            script_path.to_str().ok_or("Invalid script path")?,
            "--source",
            &source_path,
            "--output",
            db_path.to_str().ok_or("Invalid DB path")?,
            "--collection-id",
            &project_id,
            "--collection-name",
            &name,
            "--collection-icon",
            &icon,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn build process: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = app.emit(
            "project-build-error",
            serde_json::json!({ "projectId": &project_id, "error": stderr.to_string() }),
        );
        return Err(format!("Build failed: {}", stderr));
    }

    // Reopen connection
    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.open_connection(&project_id, &db_path)?;

        // Update last_built timestamp
        if let Some(project) = mgr.registry.projects.iter_mut().find(|p| p.id == project_id) {
            project.last_built = Some(unix_timestamp());
        }
        crate::projects::save_registry(&app, &mgr.registry)?;
    }

    let _ = app.emit("project-build-complete", serde_json::json!({ "projectId": &project_id }));

    Ok(())
}

#[tauri::command]
pub async fn remove_project(
    app: AppHandle,
    manager: State<'_, std::sync::Mutex<ProjectManager>>,
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

    Ok(())
}
