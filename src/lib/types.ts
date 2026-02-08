export interface Collection {
  id: string
  name: string
  icon: string
  description: string | null
  sort_order: number
}

export interface NavigationNode {
  id: number
  collection_id: string
  slug: string
  parent_slug: string
  title: string
  sort_order: number
  level: number
  has_children: boolean
}

export interface Document {
  id: number
  collection_id: string
  slug: string
  title: string
  section: string
  sort_order: number
  parent_slug: string
  content_html: string
  path: string
  last_modified: string | null
}

export interface SearchResult {
  slug: string
  title: string
  section: string
  collection_id: string
  snippet: string
}

export interface Tag {
  tag: string
  count: number
}

export interface Chunk {
  id: number
  document_id: number
  chunk_index: number
  content_text: string
  heading_context: string
}

export type AiProvider = 'openai' | 'anthropic' | 'ollama'

export interface Settings {
  openai_api_key: string | null
  anthropic_api_key: string | null
  ollama_base_url: string | null
  preferred_provider: string | null
  anthropic_model: string | null
}

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiConversation {
  question: string
  response: string
  loading: boolean
  error: string | null
  provider: AiProvider | null
}
