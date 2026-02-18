use crate::models::{AiProvider, ScoredChunk, Settings};
use crate::projects::ProjectManager;
use rusqlite::params;
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

/// Cached Ollama availability status with a 30-second TTL.
static OLLAMA_AVAILABLE_CACHE: Mutex<Option<(bool, Instant)>> = Mutex::new(None);
const OLLAMA_CACHE_TTL_SECS: u64 = 30;
static CANCELLED_REQUESTS: Mutex<Option<HashSet<String>>> = Mutex::new(None);

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiResponseChunkEvent {
    pub request_id: String,
    pub content: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiResponseDoneEvent {
    pub request_id: String,
    pub cancelled: bool,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiResponseErrorEvent {
    pub request_id: String,
    pub message: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiSourceReference {
    pub chunk_id: i32,
    pub document_id: i32,
    pub doc_slug: String,
    pub doc_title: String,
    pub heading_context: String,
    pub excerpt: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiResponseSourcesEvent {
    pub request_id: String,
    pub sources: Vec<AiSourceReference>,
}

pub fn error_event(request_id: &str, message: &str) -> AiResponseErrorEvent {
    AiResponseErrorEvent {
        request_id: request_id.to_string(),
        message: message.to_string(),
    }
}

fn build_source_references(
    db: &rusqlite::Connection,
    chunks: &[ScoredChunk],
    limit: usize,
) -> Result<Vec<AiSourceReference>, String> {
    if chunks.is_empty() || limit == 0 {
        return Ok(vec![]);
    }

    let mut doc_meta: HashMap<i32, (String, String)> = HashMap::new();
    let mut stmt = db
        .prepare_cached("SELECT slug, title FROM documents WHERE id = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;

    let mut sources = Vec::new();
    for chunk in chunks.iter().take(limit) {
        let (doc_slug, doc_title) = if let Some(cached) = doc_meta.get(&chunk.document_id) {
            cached.clone()
        } else {
            let meta = stmt
                .query_row(params![chunk.document_id], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|e| format!("Failed to resolve source document: {}", e))?;
            doc_meta.insert(chunk.document_id, meta.clone());
            meta
        };

        let excerpt = chunk
            .content_text
            .split_whitespace()
            .take(28)
            .collect::<Vec<_>>()
            .join(" ");

        sources.push(AiSourceReference {
            chunk_id: chunk.id,
            document_id: chunk.document_id,
            doc_slug,
            doc_title,
            heading_context: chunk.heading_context.clone(),
            excerpt,
        });
    }

    Ok(sources)
}

pub fn cancel_request(request_id: &str) -> Result<(), String> {
    let mut guard = CANCELLED_REQUESTS.lock().map_err(|e| e.to_string())?;
    let set = guard.get_or_insert_with(HashSet::new);
    set.insert(request_id.to_string());
    Ok(())
}

fn clear_cancel_request(request_id: &str) {
    if let Ok(mut guard) = CANCELLED_REQUESTS.lock() {
        if let Some(set) = guard.as_mut() {
            set.remove(request_id);
        }
    }
}

fn is_cancelled(request_id: &str) -> bool {
    CANCELLED_REQUESTS
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|set| set.contains(request_id)))
        .unwrap_or(false)
}

fn table_exists(db: &rusqlite::Connection, table_name: &str) -> bool {
    db.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
        params![table_name],
        |row| row.get::<_, i64>(0),
    )
    .map(|exists| exists == 1)
    .unwrap_or(false)
}

// -- FTS5 query sanitisation --

/// Sanitise user input for FTS5 MATCH queries by wrapping each term in double quotes.
/// This prevents FTS5 special characters (*, -, ^, etc.) from being interpreted as operators.
pub(crate) fn sanitise_fts5_query(input: &str) -> String {
    input
        .split_whitespace()
        .map(|term| {
            let is_prefix = term.ends_with('*');
            let base = if is_prefix {
                &term[..term.len() - 1]
            } else {
                term
            };
            // Strip any characters that could break out of double-quoted FTS5 tokens
            let clean: String = base.chars().filter(|c| *c != '"').collect();
            if clean.is_empty() {
                return String::new();
            }
            if is_prefix {
                // Place * outside quotes for valid FTS5 prefix matching
                format!("\"{}\"*", clean)
            } else {
                format!("\"{}\"", clean)
            }
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" OR ")
}

// -- Embedding generation --

/// Generate an embedding vector for the given text using the configured provider.
pub async fn generate_embedding(
    client: &reqwest::Client,
    settings: &Settings,
    provider: &AiProvider,
    text: &str,
) -> Result<Vec<f32>, String> {
    match provider {
        AiProvider::Openai => generate_openai_embedding(client, settings, text).await,
        AiProvider::Gemini => generate_gemini_embedding(client, settings, text).await,
        AiProvider::Ollama => generate_ollama_embedding(client, settings, text).await,
        // Anthropic has no embedding API; fall back to Ollama, then error
        AiProvider::Anthropic => {
            if is_ollama_available(client, settings).await {
                generate_ollama_embedding(client, settings, text).await
            } else if settings.openai_api_key.is_some() {
                generate_openai_embedding(client, settings, text).await
            } else if settings.gemini_api_key.is_some() {
                generate_gemini_embedding(client, settings, text).await
            } else {
                Err("Anthropic does not provide an embedding API. Please configure Ollama, OpenAI, or Gemini for embeddings.".to_string())
            }
        }
    }
}

async fn generate_openai_embedding(
    client: &reqwest::Client,
    settings: &Settings,
    text: &str,
) -> Result<Vec<f32>, String> {
    let api_key = settings
        .openai_api_key
        .as_ref()
        .ok_or("OpenAI API key not configured")?;

    let body = serde_json::json!({
        "model": "text-embedding-3-small",
        "input": text,
    });

    let resp = client
        .post("https://api.openai.com/v1/embeddings")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI embedding request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error ({}): {}", status, text));
    }

    #[derive(Deserialize)]
    struct EmbeddingData {
        embedding: Vec<f32>,
    }
    #[derive(Deserialize)]
    struct EmbeddingResponse {
        data: Vec<EmbeddingData>,
    }

    let parsed: EmbeddingResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OpenAI embedding response: {}", e))?;

    parsed
        .data
        .into_iter()
        .next()
        .map(|d| d.embedding)
        .ok_or_else(|| "No embedding returned from OpenAI".to_string())
}

async fn generate_ollama_embedding(
    client: &reqwest::Client,
    settings: &Settings,
    text: &str,
) -> Result<Vec<f32>, String> {
    let base_url = settings
        .ollama_base_url
        .as_deref()
        .unwrap_or("http://localhost:11434");

    let body = serde_json::json!({
        "model": "nomic-embed-text",
        "prompt": text,
    });

    let resp = client
        .post(format!("{}/api/embeddings", base_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama embedding request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, text));
    }

    #[derive(Deserialize)]
    struct OllamaEmbeddingResponse {
        embedding: Vec<f32>,
    }

    let parsed: OllamaEmbeddingResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama embedding response: {}", e))?;

    Ok(parsed.embedding)
}

async fn generate_gemini_embedding(
    client: &reqwest::Client,
    settings: &Settings,
    text: &str,
) -> Result<Vec<f32>, String> {
    let api_key = settings
        .gemini_api_key
        .as_ref()
        .ok_or("Gemini API key not configured")?;

    let body = serde_json::json!({
        "model": "models/text-embedding-004",
        "content": {
            "parts": [{ "text": text }]
        }
    });

    let resp = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={}",
            api_key
        ))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini embedding request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API error ({}): {}", status, text));
    }

    #[derive(Deserialize)]
    struct GeminiEmbeddingResponse {
        embedding: GeminiEmbeddingValues,
    }

    #[derive(Deserialize)]
    struct GeminiEmbeddingValues {
        values: Vec<f32>,
    }

    let parsed: GeminiEmbeddingResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini embedding response: {}", e))?;

    Ok(parsed.embedding.values)
}

async fn is_ollama_available(client: &reqwest::Client, settings: &Settings) -> bool {
    // Return cached result if still fresh
    if let Ok(cache) = OLLAMA_AVAILABLE_CACHE.lock() {
        if let Some((available, checked_at)) = *cache {
            if checked_at.elapsed().as_secs() < OLLAMA_CACHE_TTL_SECS {
                return available;
            }
        }
    }

    let base_url = settings
        .ollama_base_url
        .as_deref()
        .unwrap_or("http://localhost:11434");

    let available = client.get(base_url).send().await.is_ok();

    if let Ok(mut cache) = OLLAMA_AVAILABLE_CACHE.lock() {
        *cache = Some((available, Instant::now()));
    }

    available
}

// -- Vector similarity search --

/// Compute cosine similarity between two float32 vectors.
fn cosine_similarity(a: &[f32], b: &[f32]) -> Option<f64> {
    if a.len() != b.len() || a.is_empty() {
        return None;
    }

    let mut dot = 0.0f64;
    let mut mag_a = 0.0f64;
    let mut mag_b = 0.0f64;

    for (x, y) in a.iter().zip(b.iter()) {
        let x = *x as f64;
        let y = *y as f64;
        dot += x * y;
        mag_a += x * x;
        mag_b += y * y;
    }

    let denom = mag_a.sqrt() * mag_b.sqrt();
    if denom == 0.0 {
        None
    } else {
        Some(dot / denom)
    }
}

/// Decode a BLOB of little-endian float32 values into a Vec<f32>.
fn decode_embedding_blob(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

/// Perform vector similarity search against stored chunk embeddings.
pub fn vector_search(
    db: &rusqlite::Connection,
    query_embedding: &[f32],
    limit: usize,
) -> Result<Vec<ScoredChunk>, String> {
    if limit == 0 || query_embedding.is_empty() {
        return Ok(vec![]);
    }
    if !table_exists(db, "chunk_embeddings") {
        return Ok(vec![]);
    }

    let mut stmt = db
        .prepare_cached(
            "SELECT ce.chunk_id, ce.embedding, c.document_id, c.chunk_index, c.content_text, c.heading_context \
             FROM chunk_embeddings ce \
             JOIN chunks c ON c.id = ce.chunk_id",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<_> = stmt
        .query_map([], |row| {
            let chunk_id: i32 = row.get(0)?;
            let blob: Vec<u8> = row.get(1)?;
            let document_id: i32 = row.get(2)?;
            let chunk_index: i32 = row.get(3)?;
            let content_text: String = row.get(4)?;
            let heading_context: String = row.get(5)?;
            Ok((
                chunk_id,
                blob,
                document_id,
                chunk_index,
                content_text,
                heading_context,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Error reading embedding rows: {}", e))?;

    let mut scored: Vec<ScoredChunk> = rows
        .into_iter()
        .filter_map(
            |(chunk_id, blob, document_id, chunk_index, content_text, heading_context)| {
                let stored = decode_embedding_blob(&blob);
                let score = cosine_similarity(query_embedding, &stored)?;
                // Skip zero/negative scores to avoid noisy ordering and
                // dimension-mismatch artefacts dominating hybrid retrieval.
                if score <= 0.0 || !score.is_finite() {
                    return None;
                }
                Some(ScoredChunk {
                    id: chunk_id,
                    document_id,
                    chunk_index,
                    content_text,
                    heading_context,
                    score,
                })
            },
        )
        .collect();

    scored.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    scored.truncate(limit);
    Ok(scored)
}

/// Extract meaningful keywords from a query, stripping common stop words.
fn extract_keywords(query: &str) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "has",
        "have", "how", "i", "in", "is", "it", "its", "my", "not", "of", "on", "or", "our",
        "should", "so", "that", "the", "their", "them", "then", "there", "these", "they", "this",
        "to", "was", "we", "what", "when", "where", "which", "who", "why", "will", "with", "would",
        "you", "your",
    ];

    let cleaned_terms = query
        .split_whitespace()
        .map(|w| w.to_lowercase())
        .map(|w| {
            w.chars()
                .filter(|c| c.is_alphanumeric())
                .collect::<String>()
        })
        .filter(|w| w.len() >= 2)
        .collect::<Vec<_>>();

    let keywords = cleaned_terms
        .iter()
        .filter(|w| !STOP_WORDS.contains(&w.as_str()))
        .cloned()
        .collect::<Vec<_>>();

    // For stopword-heavy prompts ("what is this about", etc.), keep a small
    // fallback token set rather than returning no matches.
    if keywords.is_empty() {
        cleaned_terms.into_iter().take(6).collect()
    } else {
        keywords
    }
}

/// Perform FTS5 search for chunks whose content matches the query text.
pub fn fts_chunk_search(
    db: &rusqlite::Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<ScoredChunk>, String> {
    let keywords = extract_keywords(query);

    if keywords.is_empty() {
        return Ok(vec![]);
    }

    let has_fts = table_exists(db, "chunks_fts");

    if has_fts {
        // Wrap each keyword in double quotes for safe FTS5 matching
        let fts_query = keywords
            .iter()
            .map(|k| format!("\"{}\"", k))
            .collect::<Vec<_>>()
            .join(" OR ");

        let mut stmt = db
            .prepare_cached(
                "SELECT c.id, c.document_id, c.chunk_index, c.content_text, c.heading_context \
                 FROM chunks_fts \
                 JOIN chunks c ON c.id = chunks_fts.rowid \
                 WHERE chunks_fts MATCH ? \
                 ORDER BY rank \
                 LIMIT ?",
            )
            .map_err(|e| e.to_string())?;

        let results: Vec<ScoredChunk> = stmt
            .query_map(params![fts_query, limit as i32], |row| {
                Ok(ScoredChunk {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    chunk_index: row.get(2)?,
                    content_text: row.get(3)?,
                    heading_context: row.get(4)?,
                    score: 0.5,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Error reading FTS chunk rows: {}", e))?;

        Ok(results)
    } else {
        // Fall back to LIKE search — search for individual keywords
        let conditions: Vec<String> = keywords
            .iter()
            .map(|_| "content_text LIKE ?".to_string())
            .collect();
        let where_clause = conditions.join(" OR ");
        let sql = format!(
            "SELECT id, document_id, chunk_index, content_text, heading_context \
             FROM chunks \
             WHERE {} \
             LIMIT ?",
            where_clause
        );

        let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

        let mut param_values: Vec<rusqlite::types::Value> = keywords
            .iter()
            .map(|k| rusqlite::types::Value::Text(format!("%{}%", k)))
            .collect();
        param_values.push(rusqlite::types::Value::Integer(limit as i64));

        let results: Vec<ScoredChunk> = stmt
            .query_map(rusqlite::params_from_iter(param_values.iter()), |row| {
                Ok(ScoredChunk {
                    id: row.get(0)?,
                    document_id: row.get(1)?,
                    chunk_index: row.get(2)?,
                    content_text: row.get(3)?,
                    heading_context: row.get(4)?,
                    score: 0.3,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Error reading LIKE search rows: {}", e))?;

        Ok(results)
    }
}

/// Hybrid retrieval: combine vector and FTS results, deduplicate, and return top chunks.
pub fn hybrid_search(
    db: &rusqlite::Connection,
    query_embedding: &[f32],
    query_text: &str,
    limit: usize,
) -> Result<Vec<ScoredChunk>, String> {
    if limit == 0 {
        return Ok(vec![]);
    }

    let vector_results = vector_search(db, query_embedding, 20).unwrap_or_else(|e| {
        eprintln!(
            "Warning: vector search failed, falling back to text search only: {}",
            e
        );
        vec![]
    });
    let fts_results = fts_chunk_search(db, query_text, 20)?;

    // Merge by chunk id and boost text matches, so exact keyword hits are not
    // drowned out by weak vector scores.
    let mut merged: HashMap<i32, ScoredChunk> = HashMap::new();
    for chunk in vector_results {
        merged.insert(chunk.id, chunk);
    }
    for mut chunk in fts_results {
        if let Some(existing) = merged.get_mut(&chunk.id) {
            existing.score += 0.35;
        } else {
            chunk.score = chunk.score.max(0.35);
            merged.insert(chunk.id, chunk);
        }
    }

    let mut combined = merged.into_values().collect::<Vec<_>>();
    combined.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    combined.truncate(limit);
    Ok(combined)
}

// -- Prompt construction --

/// Build the system prompt with context chunks for the RAG flow.
fn build_rag_prompt(chunks: &[ScoredChunk], question: &str) -> Vec<AiChatMessage> {
    let system_content = "You are a helpful assistant for an engineering handbook. \
        Answer questions based on the provided context from the handbook. \
        If the context does not contain enough information to answer, say so honestly. \
        Use clear, concise language. Format your response with markdown where appropriate.";

    let mut context_parts = Vec::new();
    for (i, chunk) in chunks.iter().enumerate() {
        let heading = if chunk.heading_context.is_empty() {
            String::new()
        } else {
            format!(" ({})", chunk.heading_context)
        };
        context_parts.push(format!(
            "--- Context {} ---{}\n{}",
            i + 1,
            heading,
            chunk.content_text
        ));
    }

    let context_block = if context_parts.is_empty() {
        "No relevant context was found in the handbook.".to_string()
    } else {
        context_parts.join("\n\n")
    };

    let user_content = format!(
        "Here is relevant context from the engineering handbook:\n\n{}\n\n---\n\nQuestion: {}",
        context_block, question
    );

    vec![
        AiChatMessage {
            role: "system".to_string(),
            content: system_content.to_string(),
        },
        AiChatMessage {
            role: "user".to_string(),
            content: user_content,
        },
    ]
}

#[derive(serde::Serialize, Clone)]
pub(crate) struct AiChatMessage {
    role: String,
    content: String,
}

// -- Streaming chat --

/// Stream a chat response from the configured provider via Tauri events.
pub async fn stream_chat_response(
    client: &reqwest::Client,
    app: &AppHandle,
    settings: &Settings,
    request_id: &str,
    provider: &AiProvider,
    messages: &[AiChatMessage],
) -> Result<(), String> {
    match provider {
        AiProvider::Openai => stream_openai(client, app, settings, request_id, messages).await,
        AiProvider::Anthropic => {
            stream_anthropic(client, app, settings, request_id, messages).await
        }
        AiProvider::Gemini => stream_gemini(client, app, settings, request_id, messages).await,
        AiProvider::Ollama => stream_ollama(client, app, settings, request_id, messages).await,
    }
}

async fn stream_openai(
    client: &reqwest::Client,
    app: &AppHandle,
    settings: &Settings,
    request_id: &str,
    messages: &[AiChatMessage],
) -> Result<(), String> {
    let api_key = settings
        .openai_api_key
        .as_ref()
        .ok_or("OpenAI API key not configured")?;

    let body = serde_json::json!({
        "model": "gpt-4o",
        "messages": messages,
        "stream": true,
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error ({}): {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();

    let mut buffer = String::new();

    'outer: while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(line_end) = buffer.find('\n') {
            let line: String = buffer.drain(..=line_end).collect();
            let line = line.trim();

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    if let Err(e) = app.emit(
                        "ai-response-done",
                        AiResponseDoneEvent {
                            request_id: request_id.to_string(),
                            cancelled: false,
                        },
                    ) {
                        eprintln!("Warning: failed to emit ai-response-done: {}", e);
                    }
                    clear_cancel_request(request_id);
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                        if app
                            .emit(
                                "ai-response-chunk",
                                AiResponseChunkEvent {
                                    request_id: request_id.to_string(),
                                    content: content.to_string(),
                                },
                            )
                            .is_err()
                        {
                            break 'outer;
                        }
                    }
                }
            }
        }

        if is_cancelled(request_id) {
            if let Err(e) = app.emit(
                "ai-response-done",
                AiResponseDoneEvent {
                    request_id: request_id.to_string(),
                    cancelled: true,
                },
            ) {
                eprintln!("Warning: failed to emit ai-response-done: {}", e);
            }
            clear_cancel_request(request_id);
            return Ok(());
        }
    }

    if let Err(e) = app.emit(
        "ai-response-done",
        AiResponseDoneEvent {
            request_id: request_id.to_string(),
            cancelled: false,
        },
    ) {
        eprintln!("Warning: failed to emit ai-response-done: {}", e);
    }
    clear_cancel_request(request_id);
    Ok(())
}

async fn stream_anthropic(
    client: &reqwest::Client,
    app: &AppHandle,
    settings: &Settings,
    request_id: &str,
    messages: &[AiChatMessage],
) -> Result<(), String> {
    let api_key = settings
        .anthropic_api_key
        .as_ref()
        .ok_or("Anthropic API key not configured")?;

    // Separate system message from user/assistant messages for Anthropic's API format
    let system_msg = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());

    let chat_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();

    let mut body = serde_json::json!({
        "model": settings.anthropic_model(),
        "max_tokens": 4096,
        "messages": chat_messages,
        "stream": true,
    });

    if let Some(sys) = system_msg {
        body["system"] = serde_json::Value::String(sys);
    }

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error ({}): {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    'outer: while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line: String = buffer.drain(..=line_end).collect();
            let line = line.trim();

            if let Some(data) = line.strip_prefix("data: ") {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = parsed["type"].as_str().unwrap_or("");

                    match event_type {
                        "content_block_delta" => {
                            if let Some(text) = parsed["delta"]["text"].as_str() {
                                if app
                                    .emit(
                                        "ai-response-chunk",
                                        AiResponseChunkEvent {
                                            request_id: request_id.to_string(),
                                            content: text.to_string(),
                                        },
                                    )
                                    .is_err()
                                {
                                    break 'outer;
                                }
                            }
                        }
                        "message_stop" => {
                            if let Err(e) = app.emit(
                                "ai-response-done",
                                AiResponseDoneEvent {
                                    request_id: request_id.to_string(),
                                    cancelled: false,
                                },
                            ) {
                                eprintln!("Warning: failed to emit ai-response-done: {}", e);
                            }
                            clear_cancel_request(request_id);
                            return Ok(());
                        }
                        _ => {}
                    }
                }
            }
        }

        if is_cancelled(request_id) {
            if let Err(e) = app.emit(
                "ai-response-done",
                AiResponseDoneEvent {
                    request_id: request_id.to_string(),
                    cancelled: true,
                },
            ) {
                eprintln!("Warning: failed to emit ai-response-done: {}", e);
            }
            clear_cancel_request(request_id);
            return Ok(());
        }
    }

    if let Err(e) = app.emit(
        "ai-response-done",
        AiResponseDoneEvent {
            request_id: request_id.to_string(),
            cancelled: false,
        },
    ) {
        eprintln!("Warning: failed to emit ai-response-done: {}", e);
    }
    clear_cancel_request(request_id);
    Ok(())
}

async fn stream_ollama(
    client: &reqwest::Client,
    app: &AppHandle,
    settings: &Settings,
    request_id: &str,
    messages: &[AiChatMessage],
) -> Result<(), String> {
    let base_url = settings
        .ollama_base_url
        .as_deref()
        .unwrap_or("http://localhost:11434");

    let ollama_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": "llama3",
        "messages": ollama_messages,
        "stream": true,
    });

    let resp = client
        .post(format!("{}/api/chat", base_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}. Is Ollama running?", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama API error ({}): {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();

    'outer: while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line: String = buffer.drain(..=line_end).collect();
            let line = line.trim();

            if line.is_empty() {
                continue;
            }

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(content) = parsed["message"]["content"].as_str() {
                    if app
                        .emit(
                            "ai-response-chunk",
                            AiResponseChunkEvent {
                                request_id: request_id.to_string(),
                                content: content.to_string(),
                            },
                        )
                        .is_err()
                    {
                        break 'outer;
                    }
                }

                if parsed["done"].as_bool() == Some(true) {
                    if let Err(e) = app.emit(
                        "ai-response-done",
                        AiResponseDoneEvent {
                            request_id: request_id.to_string(),
                            cancelled: false,
                        },
                    ) {
                        eprintln!("Warning: failed to emit ai-response-done: {}", e);
                    }
                    clear_cancel_request(request_id);
                    return Ok(());
                }
            }
        }

        if is_cancelled(request_id) {
            if let Err(e) = app.emit(
                "ai-response-done",
                AiResponseDoneEvent {
                    request_id: request_id.to_string(),
                    cancelled: true,
                },
            ) {
                eprintln!("Warning: failed to emit ai-response-done: {}", e);
            }
            clear_cancel_request(request_id);
            return Ok(());
        }
    }

    if let Err(e) = app.emit(
        "ai-response-done",
        AiResponseDoneEvent {
            request_id: request_id.to_string(),
            cancelled: false,
        },
    ) {
        eprintln!("Warning: failed to emit ai-response-done: {}", e);
    }
    clear_cancel_request(request_id);
    Ok(())
}

async fn stream_gemini(
    client: &reqwest::Client,
    app: &AppHandle,
    settings: &Settings,
    request_id: &str,
    messages: &[AiChatMessage],
) -> Result<(), String> {
    let api_key = settings
        .gemini_api_key
        .as_ref()
        .ok_or("Gemini API key not configured")?;

    let system_instruction = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone())
        .unwrap_or_default();
    let user_prompt = messages
        .iter()
        .filter(|m| m.role == "user")
        .map(|m| m.content.clone())
        .collect::<Vec<_>>()
        .join("\n\n");

    let body = serde_json::json!({
        "systemInstruction": {
            "parts": [{ "text": system_instruction }]
        },
        "contents": [{
            "role": "user",
            "parts": [{ "text": user_prompt }]
        }]
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
        settings.gemini_model(),
        api_key
    );

    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini API error ({}): {}", status, text));
    }

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut emitted_text = String::new();

    'outer: while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(line_end) = buffer.find('\n') {
            let line: String = buffer.drain(..=line_end).collect();
            let line = line.trim();

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    if let Err(e) = app.emit(
                        "ai-response-done",
                        AiResponseDoneEvent {
                            request_id: request_id.to_string(),
                            cancelled: false,
                        },
                    ) {
                        eprintln!("Warning: failed to emit ai-response-done: {}", e);
                    }
                    clear_cancel_request(request_id);
                    return Ok(());
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(text) =
                        parsed["candidates"][0]["content"]["parts"][0]["text"].as_str()
                    {
                        let delta = if let Some(suffix) = text.strip_prefix(&emitted_text) {
                            suffix.to_string()
                        } else {
                            text.to_string()
                        };
                        if !delta.is_empty() {
                            emitted_text.push_str(&delta);
                            if app
                                .emit(
                                    "ai-response-chunk",
                                    AiResponseChunkEvent {
                                        request_id: request_id.to_string(),
                                        content: delta,
                                    },
                                )
                                .is_err()
                            {
                                break 'outer;
                            }
                        }
                    }
                }
            }
        }

        if is_cancelled(request_id) {
            if let Err(e) = app.emit(
                "ai-response-done",
                AiResponseDoneEvent {
                    request_id: request_id.to_string(),
                    cancelled: true,
                },
            ) {
                eprintln!("Warning: failed to emit ai-response-done: {}", e);
            }
            clear_cancel_request(request_id);
            return Ok(());
        }
    }

    if let Err(e) = app.emit(
        "ai-response-done",
        AiResponseDoneEvent {
            request_id: request_id.to_string(),
            cancelled: false,
        },
    ) {
        eprintln!("Warning: failed to emit ai-response-done: {}", e);
    }
    clear_cancel_request(request_id);
    Ok(())
}

// -- Provider connection testing --

pub async fn test_provider_connection(
    client: &reqwest::Client,
    settings: &Settings,
    provider: &AiProvider,
) -> Result<String, String> {
    match provider {
        AiProvider::Openai => {
            let api_key = settings
                .openai_api_key
                .as_ref()
                .ok_or("OpenAI API key not configured")?;

            let resp = client
                .get("https://api.openai.com/v1/models")
                .header("Authorization", format!("Bearer {}", api_key))
                .send()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;

            if resp.status().is_success() {
                Ok("OpenAI connection successful".to_string())
            } else {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                Err(format!("OpenAI API error ({}): {}", status, text))
            }
        }
        AiProvider::Anthropic => {
            let api_key = settings
                .anthropic_api_key
                .as_ref()
                .ok_or("Anthropic API key not configured")?;

            // Send a minimal request to verify the key
            let body = serde_json::json!({
                "model": settings.anthropic_model(),
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "Hi"}],
            });

            let resp = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;

            if resp.status().is_success() {
                Ok("Anthropic connection successful".to_string())
            } else {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                Err(format!("Anthropic API error ({}): {}", status, text))
            }
        }
        AiProvider::Gemini => {
            let api_key = settings
                .gemini_api_key
                .as_ref()
                .ok_or("Gemini API key not configured")?;

            let resp = client
                .get(format!(
                    "https://generativelanguage.googleapis.com/v1beta/models?key={}",
                    api_key
                ))
                .send()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;

            if resp.status().is_success() {
                Ok("Gemini connection successful".to_string())
            } else {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                Err(format!("Gemini API error ({}): {}", status, text))
            }
        }
        AiProvider::Ollama => {
            let base_url = settings
                .ollama_base_url
                .as_deref()
                .unwrap_or("http://localhost:11434");

            let resp = client
                .get(base_url)
                .send()
                .await
                .map_err(|e| format!("Ollama not reachable: {}. Is Ollama running?", e))?;

            if resp.status().is_success() {
                Ok("Ollama connection successful".to_string())
            } else {
                Err(format!("Ollama returned status {}", resp.status()))
            }
        }
    }
}

// -- Full RAG pipeline --

/// Execute the full RAG pipeline: embed query, search, build prompt, stream response.
pub async fn ask_question_rag(
    client: reqwest::Client,
    app: AppHandle,
    request_id: String,
    question: String,
    provider: AiProvider,
) -> Result<(), String> {
    clear_cancel_request(&request_id);
    let settings = crate::settings::load_settings(&app)?;

    // Step 1: Generate query embedding
    let query_embedding = generate_embedding(&client, &settings, &provider, &question).await;

    // Step 2: Search for relevant chunks
    let (chunks, sources) = {
        let manager = app.state::<Mutex<ProjectManager>>();
        let mgr = manager.lock().map_err(|e| e.to_string())?;
        let conn = mgr.active_connection()?;

        let chunks = match query_embedding {
            Ok(ref embedding) => hybrid_search(&conn, embedding, &question, 8)?,
            Err(_) => {
                // If embedding generation failed, fall back to FTS only
                fts_chunk_search(&conn, &question, 8)?
            }
        };

        let sources = build_source_references(&conn, &chunks, 6)?;
        (chunks, sources)
    };

    let _ = app.emit(
        "ai-response-sources",
        AiResponseSourcesEvent {
            request_id: request_id.clone(),
            sources,
        },
    );

    // Step 3: Build prompt
    let messages = build_rag_prompt(&chunks, &question);

    // Step 4: Stream response
    let result =
        stream_chat_response(&client, &app, &settings, &request_id, &provider, &messages).await;
    if result.is_err() {
        clear_cancel_request(&request_id);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::{hybrid_search, vector_search};
    use rusqlite::Connection;

    fn encode_f32_blob(values: &[f32]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(values.len() * 4);
        for value in values {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
        bytes
    }

    #[test]
    fn vector_search_returns_empty_if_embeddings_table_missing() {
        let db = Connection::open_in_memory().expect("open in-memory sqlite");
        db.execute_batch(
            "CREATE TABLE chunks (
                id INTEGER PRIMARY KEY,
                document_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content_text TEXT NOT NULL,
                heading_context TEXT NOT NULL DEFAULT ''
            );",
        )
        .expect("create chunks table");

        let results = vector_search(&db, &[0.2_f32, 0.8_f32], 8).expect("vector search succeeds");
        assert!(results.is_empty(), "missing table should not hard-fail");
    }

    #[test]
    fn hybrid_search_falls_back_to_text_when_vector_scores_invalid() {
        let db = Connection::open_in_memory().expect("open in-memory sqlite");
        db.execute_batch(
            "CREATE TABLE chunks (
                id INTEGER PRIMARY KEY,
                document_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content_text TEXT NOT NULL,
                heading_context TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE chunk_embeddings (
                chunk_id INTEGER PRIMARY KEY,
                embedding BLOB
            );",
        )
        .expect("create base tables");

        db.execute(
            "INSERT INTO chunks (id, document_id, chunk_index, content_text, heading_context)
             VALUES (1, 1, 0, 'deployment runbook checklist', 'ops')",
            [],
        )
        .expect("insert chunk");

        // Deliberately mismatched dimensionality (1D vs 2D query embedding).
        db.execute(
            "INSERT INTO chunk_embeddings (chunk_id, embedding) VALUES (?1, ?2)",
            rusqlite::params![1_i32, encode_f32_blob(&[0.42_f32])],
        )
        .expect("insert embedding");

        let results = hybrid_search(&db, &[0.1_f32, 0.2_f32], "deployment checklist", 5)
            .expect("hybrid search succeeds");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }
}
