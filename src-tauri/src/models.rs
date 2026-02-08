use serde::Serialize;

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

#[derive(Debug, Serialize, serde::Deserialize, Clone)]
pub struct Settings {
    pub openai_api_key: Option<String>,
    pub anthropic_api_key: Option<String>,
    pub ollama_base_url: Option<String>,
    pub preferred_provider: Option<String>,
    pub anthropic_model: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            openai_api_key: None,
            anthropic_api_key: None,
            ollama_base_url: Some("http://localhost:11434".to_string()),
            preferred_provider: None,
            anthropic_model: None,
        }
    }
}

impl Settings {
    pub fn anthropic_model(&self) -> &str {
        self.anthropic_model.as_deref().unwrap_or("claude-sonnet-4-20250514")
    }
}

#[derive(Debug, Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Openai,
    Anthropic,
    Ollama,
}

