use crate::ai;
use crate::db::DbState;
use crate::models::*;
use crate::settings;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_collections(db: State<DbState>) -> Result<Vec<Collection>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
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
    db: State<DbState>,
    collection_id: String,
) -> Result<Vec<NavigationNode>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
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
pub fn get_document(db: State<DbState>, slug: String) -> Result<Document, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, collection_id, slug, title, section, sort_order, parent_slug, \
         content_html, content_raw, path \
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
                content_raw: row.get(8)?,
                path: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_documents(
    db: State<DbState>,
    query: String,
    collection_id: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20);

    let results = if let Some(ref cid) = collection_id {
        let mut stmt = conn
            .prepare(
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
            .query_map(rusqlite::params![&query, cid, limit], |row| {
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
            .prepare(
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
            .query_map(rusqlite::params![&query, limit], |row| {
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
    db: State<DbState>,
    collection_id: Option<String>,
) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let results = if let Some(ref cid) = collection_id {
        let mut stmt = conn
            .prepare(
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
            .prepare(
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
pub fn get_similar_chunks(
    db: State<DbState>,
    query_embedding: Vec<f32>,
    limit: Option<usize>,
) -> Result<Vec<ScoredChunk>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
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
    };

    settings::save_settings_to_store(&app, &merged)
}

/// If the incoming key contains "..." it is a masked value — keep the existing key.
fn merge_key(incoming: &Option<String>, existing: &Option<String>) -> Option<String> {
    match incoming {
        Some(k) if k.contains("...") => existing.clone(),
        Some(k) if k.is_empty() => None,
        other => other.clone(),
    }
}

#[tauri::command]
pub async fn test_provider(app: AppHandle, provider: AiProvider) -> Result<String, String> {
    let stored = settings::load_settings(&app)?;
    ai::test_provider_connection(&stored, &provider).await
}

#[tauri::command]
pub async fn ask_question(
    app: AppHandle,
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
                .and_then(|p| serde_json::from_value(serde_json::Value::String(p.clone())).ok())
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
    if let Err(e) = ai::ask_question_rag(app.clone(), question, provider).await {
        let _ = tauri::Emitter::emit(&app, "ai-response-error", &e);
    }

    Ok(())
}

#[tauri::command]
pub async fn get_embedding(
    app: AppHandle,
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

    ai::generate_embedding(&stored, &provider, &text).await
}
