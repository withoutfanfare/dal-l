import { invoke } from '@tauri-apps/api/core'
import type {
  Collection,
  NavigationNode,
  Document,
  SearchResult,
  Tag,
  Chunk,
  Settings,
  AiProvider,
  Project,
  ProjectStats,
  AppPreferences,
  Bookmark,
  DocActivityItem,
  BookmarkFolder,
  BookmarkTagEntity,
  BookmarkRelations,
  DocNote,
  DocHighlight,
  ProjectChangeFeedItem,
} from './types'

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

export async function askQuestion(
  question: string,
  requestId: string,
  provider?: AiProvider,
): Promise<void> {
  return invoke('ask_question', { question, requestId, provider })
}

export async function cancelAiRequest(requestId: string): Promise<void> {
  return invoke('cancel_ai_request', { requestId })
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

export async function listBookmarks(
  projectId: string,
  query?: string,
  limit?: number,
): Promise<Bookmark[]> {
  return invoke('list_bookmarks', { projectId, query, limit })
}

export async function upsertBookmark(
  projectId: string,
  collectionId: string,
  docSlug: string,
  anchorId: string | null,
  titleSnapshot: string,
): Promise<Bookmark> {
  return invoke('upsert_bookmark', {
    projectId,
    collectionId,
    docSlug,
    anchorId,
    titleSnapshot,
  })
}

export async function removeBookmark(
  projectId: string,
  docSlug: string,
  anchorId: string | null,
): Promise<boolean> {
  return invoke('remove_bookmark', { projectId, docSlug, anchorId })
}

export async function repairBookmarkTarget(
  bookmarkId: number,
  collectionId: string,
  docSlug: string,
  anchorId: string | null,
  titleSnapshot: string,
): Promise<Bookmark> {
  return invoke('repair_bookmark_target', {
    bookmarkId,
    collectionId,
    docSlug,
    anchorId,
    titleSnapshot,
  })
}

export async function touchBookmarkOpened(bookmarkId: number): Promise<void> {
  return invoke('touch_bookmark_opened', { bookmarkId })
}

export async function listBookmarkFolders(projectId: string): Promise<BookmarkFolder[]> {
  return invoke('list_bookmark_folders', { projectId })
}

export async function createBookmarkFolder(projectId: string, name: string): Promise<BookmarkFolder> {
  return invoke('create_bookmark_folder', { projectId, name })
}

export async function deleteBookmarkFolder(folderId: number): Promise<void> {
  return invoke('delete_bookmark_folder', { folderId })
}

export async function listBookmarkTags(projectId: string): Promise<BookmarkTagEntity[]> {
  return invoke('list_bookmark_tags', { projectId })
}

export async function createBookmarkTag(projectId: string, name: string): Promise<BookmarkTagEntity> {
  return invoke('create_bookmark_tag', { projectId, name })
}

export async function deleteBookmarkTag(tagId: number): Promise<void> {
  return invoke('delete_bookmark_tag', { tagId })
}

export async function listBookmarkRelations(projectId: string): Promise<BookmarkRelations[]> {
  return invoke('list_bookmark_relations', { projectId })
}

export async function bulkDeleteBookmarks(projectId: string, bookmarkIds: number[]): Promise<number> {
  return invoke('bulk_delete_bookmarks', { projectId, bookmarkIds })
}

export async function bulkSetBookmarkFolder(
  projectId: string,
  bookmarkIds: number[],
  folderId: number | null,
): Promise<void> {
  return invoke('bulk_set_bookmark_folder', { projectId, bookmarkIds, folderId })
}

export async function bulkSetBookmarkTags(
  projectId: string,
  bookmarkIds: number[],
  tagIds: number[],
): Promise<void> {
  return invoke('bulk_set_bookmark_tags', { projectId, bookmarkIds, tagIds })
}

export async function markDocumentViewed(
  projectId: string,
  docSlug: string,
  viewedAt?: number,
): Promise<void> {
  return invoke('mark_document_viewed', { projectId, docSlug, viewedAt })
}

export async function getRecentDocuments(
  projectId: string,
  limit?: number,
): Promise<DocActivityItem[]> {
  return invoke('get_recent_documents', { projectId, limit })
}

export async function getUpdatedDocuments(
  projectId: string,
  limit?: number,
): Promise<DocActivityItem[]> {
  return invoke('get_updated_documents', { projectId, limit })
}

export async function getProjectChangeFeed(
  projectId: string,
  limit?: number,
): Promise<ProjectChangeFeedItem[]> {
  return invoke('get_project_change_feed', { projectId, limit })
}

export async function getDocNote(projectId: string, docSlug: string): Promise<DocNote | null> {
  return invoke('get_doc_note', { projectId, docSlug })
}

export async function saveDocNote(projectId: string, docSlug: string, note: string): Promise<DocNote> {
  return invoke('save_doc_note', { projectId, docSlug, note })
}

export async function listDocHighlights(projectId: string, docSlug: string): Promise<DocHighlight[]> {
  return invoke('list_doc_highlights', { projectId, docSlug })
}

export async function addDocHighlight(
  projectId: string,
  docSlug: string,
  anchorId: string | null,
  selectedText: string,
  contextText?: string,
): Promise<DocHighlight> {
  return invoke('add_doc_highlight', {
    projectId,
    docSlug,
    anchorId,
    selectedText,
    contextText,
  })
}

export async function deleteDocHighlight(id: number): Promise<void> {
  return invoke('delete_doc_highlight', { id })
}
