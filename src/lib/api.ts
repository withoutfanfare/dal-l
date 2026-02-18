import { invoke } from '@tauri-apps/api/core'
import type { Collection, NavigationNode, Document, SearchResult, Tag, Chunk, Settings, AiProvider, Project, ProjectStats, AppPreferences } from './types'

export async function getCollections(): Promise<Collection[]> {
  return invoke('get_collections')
}

export async function getNavigation(collectionId: string): Promise<NavigationNode[]> {
  return invoke('get_navigation', { collectionId })
}

export async function getDocument(slug: string): Promise<Document> {
  return invoke('get_document', { slug })
}

export async function searchDocuments(
  query: string,
  collectionId?: string,
  limit?: number,
): Promise<SearchResult[]> {
  return invoke('search_documents', { query, collectionId, limit })
}

export async function getTags(collectionId?: string): Promise<Tag[]> {
  return invoke('get_tags', { collectionId })
}

export async function getDocumentsByTag(tag: string): Promise<SearchResult[]> {
  return invoke('get_documents_by_tag', { tag })
}

export async function getSimilarChunks(
  queryEmbedding: number[],
  limit?: number,
): Promise<Chunk[]> {
  return invoke('get_similar_chunks', { queryEmbedding, limit })
}

export async function getSettings(): Promise<Settings> {
  return invoke('get_settings')
}

export async function saveSettings(newSettings: Settings): Promise<void> {
  return invoke('save_settings', { newSettings })
}

export async function testProvider(provider: AiProvider): Promise<string> {
  return invoke('test_provider', { provider })
}

export async function askQuestion(question: string, provider?: AiProvider): Promise<void> {
  return invoke('ask_question', { question, provider })
}

export async function listProjects(): Promise<Project[]> {
  return invoke('list_projects')
}

export async function getActiveProjectId(): Promise<string> {
  return invoke('get_active_project_id')
}

export async function setActiveProject(projectId: string): Promise<void> {
  return invoke('set_active_project', { projectId })
}

export async function addProject(name: string, icon: string, sourcePath: string): Promise<Project> {
  return invoke('add_project', { name, icon, sourcePath })
}

export async function rebuildProject(projectId: string): Promise<void> {
  return invoke('rebuild_project', { projectId })
}

export async function removeProject(projectId: string): Promise<void> {
  return invoke('remove_project', { projectId })
}

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
  return invoke('get_project_stats', { projectId })
}

export async function openInEditor(editorCommand: string, path: string): Promise<void> {
  return invoke('open_in_editor', { editorCommand, path })
}

export async function getPreferences(): Promise<AppPreferences> {
  return invoke('get_preferences')
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  return invoke('save_preferences', { preferences })
}
