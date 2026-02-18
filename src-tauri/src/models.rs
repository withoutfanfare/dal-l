use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct NavigationNode {
    pub id: i32,
    pub collection_id: String,
    pub slug: String,
    pub parent_slug: String,
    pub title: String,
    pub sort_order: i32,
    pub level: i32,
    pub has_children: bool,
}

#[derive(Debug, Serialize)]
pub struct Document {
    pub id: i32,
    pub collection_id: String,
    pub slug: String,
    pub title: String,
    pub section: String,
    pub sort_order: i32,
    pub parent_slug: String,
    pub content_html: String,
    pub path: String,
    pub last_modified: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub slug: String,
    pub title: String,
    pub section: String,
    pub collection_id: String,
    pub snippet: String,
}

#[derive(Debug, Serialize)]
pub struct Tag {
    pub tag: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct ScoredChunk {
    pub id: i32,
    pub document_id: i32,
    pub chunk_index: i32,
    pub content_text: String,
    pub heading_context: String,
    pub score: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub document_count: i32,
    pub collection_count: i32,
    pub tag_count: i32,
    pub chunk_count: i32,
    pub embedding_count: i32,
    pub db_size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    pub editor_command: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub id: i64,
    pub project_id: String,
    pub collection_id: String,
    pub doc_slug: String,
    pub anchor_id: Option<String>,
    pub title_snapshot: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_opened_at: Option<i64>,
    pub order_index: i64,
    pub open_count: i64,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkFolder {
    pub id: i64,
    pub project_id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkTagEntity {
    pub id: i64,
    pub project_id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkRelations {
    pub bookmark_id: i64,
    pub folder_ids: Vec<i64>,
    pub tag_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocActivityItem {
    pub doc_slug: String,
    pub collection_id: String,
    pub title: String,
    pub section: String,
    pub last_modified: Option<String>,
    pub last_viewed_at: Option<i64>,
    pub updated_since_viewed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocNote {
    pub project_id: String,
    pub doc_slug: String,
    pub note: String,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocHighlight {
    pub id: i64,
    pub project_id: String,
    pub doc_slug: String,
    pub anchor_id: Option<String>,
    pub selected_text: String,
    pub context_text: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectChangeFeedItem {
    pub id: i64,
    pub project_id: String,
    pub commit_hash: String,
    pub author: String,
    pub committed_at: String,
    pub changed_files: Vec<String>,
    pub changed_doc_slugs: Vec<String>,
    pub recorded_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub ollama_base_url: Option<String>,
    pub preferred_provider: Option<String>,
    pub anthropic_model: Option<String>,
    pub gemini_model: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            openai_api_key: None,
            anthropic_api_key: None,
            gemini_api_key: None,
            ollama_base_url: None,
            preferred_provider: None,
            anthropic_model: None,
            gemini_model: None,
        }
    }
}

impl Settings {
    pub fn anthropic_model(&self) -> &str {
        self.anthropic_model
            .as_deref()
            .unwrap_or("claude-sonnet-4-20250514")
    }

    pub fn gemini_model(&self) -> &str {
        self.gemini_model.as_deref().unwrap_or("gemini-2.5-flash")
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Openai,
    Anthropic,
    Gemini,
    Ollama,
}
