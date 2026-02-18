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

export interface ProjectCollection {
  id: string
  name: string
  icon: string
  sourceSubpath: string
}

export interface Project {
  id: string
  name: string
  icon: string
  builtIn: boolean
  sourcePath?: string
  dbPath?: string
  lastBuilt?: string
  collections: ProjectCollection[]
}

export type BuildStatus = 'idle' | 'building' | 'complete' | 'error'

export interface ProjectBuildEvent {
  projectId: string
  status: BuildStatus
  message?: string
  error?: string
}

export interface ProjectStats {
  documentCount: number
  collectionCount: number
  tagCount: number
  chunkCount: number
  dbSizeBytes: number
}

export interface AppPreferences {
  editorCommand: string | null
}

export interface Bookmark {
  id: number
  projectId: string
  collectionId: string
  docSlug: string
  anchorId: string | null
  titleSnapshot: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
  orderIndex: number
  openCount: number
  isFavorite: boolean
}

export interface BookmarkFolder {
  id: number
  projectId: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface BookmarkTagEntity {
  id: number
  projectId: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface BookmarkRelations {
  bookmarkId: number
  folderIds: number[]
  tagIds: number[]
}

export interface DocActivityItem {
  docSlug: string
  collectionId: string
  title: string
  section: string
  lastModified: string | null
  lastViewedAt: number | null
  updatedSinceViewed: boolean
}

export interface DocNote {
  projectId: string
  docSlug: string
  note: string
  updatedAt: number
}

export interface DocHighlight {
  id: number
  projectId: string
  docSlug: string
  anchorId: string | null
  selectedText: string
  contextText: string | null
  createdAt: number
}

export interface ProjectChangeFeedItem {
  id: number
  projectId: string
  commitHash: string
  author: string
  committedAt: string
  changedFiles: string[]
  changedDocSlugs: string[]
  recordedAt: number
}

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama'

export interface Settings {
  openai_api_key: string | null
  anthropic_api_key: string | null
  gemini_api_key: string | null
  ollama_base_url: string | null
  preferred_provider: string | null
  anthropic_model: string | null
  gemini_model: string | null
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
