import { invoke } from '@tauri-apps/api/core'
import type { Collection, NavigationNode, Document, SearchResult, Tag, Chunk, Settings, AiProvider } from './types'

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
