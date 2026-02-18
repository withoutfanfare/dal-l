import { ref, computed } from 'vue'
import {
  listBookmarks as listBookmarksApi,
  upsertBookmark as upsertBookmarkApi,
  removeBookmark as removeBookmarkApi,
  repairBookmarkTarget as repairBookmarkTargetApi,
  touchBookmarkOpened as touchBookmarkOpenedApi,
  listBookmarkFolders as listBookmarkFoldersApi,
  createBookmarkFolder as createBookmarkFolderApi,
  deleteBookmarkFolder as deleteBookmarkFolderApi,
  listBookmarkTags as listBookmarkTagsApi,
  createBookmarkTag as createBookmarkTagApi,
  deleteBookmarkTag as deleteBookmarkTagApi,
  listBookmarkRelations as listBookmarkRelationsApi,
  bulkDeleteBookmarks as bulkDeleteBookmarksApi,
  bulkSetBookmarkFolder as bulkSetBookmarkFolderApi,
  bulkSetBookmarkTags as bulkSetBookmarkTagsApi,
} from '@/lib/api'
import type { Bookmark, BookmarkFolder, BookmarkTagEntity, BookmarkRelations } from '@/lib/types'

const bookmarks = ref<Bookmark[]>([])
const folders = ref<BookmarkFolder[]>([])
const tags = ref<BookmarkTagEntity[]>([])
const relations = ref<BookmarkRelations[]>([])
const loading = ref(false)
const loadingManagement = ref(false)
const loadedProjectId = ref<string | null>(null)

function sameAnchor(a: string | null, b: string | null): boolean {
  return (a ?? null) === (b ?? null)
}

export function useBookmarks() {
  const relationByBookmarkId = computed(() => {
    const map = new Map<number, BookmarkRelations>()
    for (const relation of relations.value) {
      map.set(relation.bookmarkId, relation)
    }
    return map
  })

  const byDocSlug = computed(() => {
    const map = new Map<string, Bookmark[]>()
    for (const bookmark of bookmarks.value) {
      const list = map.get(bookmark.docSlug) ?? []
      list.push(bookmark)
      map.set(bookmark.docSlug, list)
    }
    return map
  })

  async function loadBookmarks(projectId: string, query?: string) {
    if (!projectId) {
      bookmarks.value = []
      loadedProjectId.value = null
      return
    }

    loading.value = true
    try {
      bookmarks.value = await listBookmarksApi(projectId, query)
      loadedProjectId.value = projectId
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded(projectId: string) {
    if (loadedProjectId.value === projectId) return
    await loadBookmarks(projectId)
    await loadManagement(projectId)
  }

  async function loadManagement(projectId: string) {
    if (!projectId) {
      folders.value = []
      tags.value = []
      relations.value = []
      return
    }

    loadingManagement.value = true
    try {
      const [nextFolders, nextTags, nextRelations] = await Promise.all([
        listBookmarkFoldersApi(projectId),
        listBookmarkTagsApi(projectId),
        listBookmarkRelationsApi(projectId),
      ])
      folders.value = nextFolders
      tags.value = nextTags
      relations.value = nextRelations
    } finally {
      loadingManagement.value = false
    }
  }

  function findBookmark(projectId: string, docSlug: string, anchorId: string | null = null) {
    return bookmarks.value.find((bookmark) =>
      bookmark.projectId === projectId
      && bookmark.docSlug === docSlug
      && sameAnchor(bookmark.anchorId, anchorId),
    )
  }

  function isBookmarked(projectId: string, docSlug: string, anchorId: string | null = null): boolean {
    return !!findBookmark(projectId, docSlug, anchorId)
  }

  async function upsertBookmark(
    projectId: string,
    collectionId: string,
    docSlug: string,
    anchorId: string | null,
    titleSnapshot: string,
  ): Promise<Bookmark> {
    const bookmark = await upsertBookmarkApi(projectId, collectionId, docSlug, anchorId, titleSnapshot)
    const idx = bookmarks.value.findIndex((item) => item.id === bookmark.id)
    if (idx >= 0) {
      bookmarks.value[idx] = bookmark
    } else {
      bookmarks.value.unshift(bookmark)
    }
    loadedProjectId.value = projectId
    return bookmark
  }

  async function removeBookmark(projectId: string, docSlug: string, anchorId: string | null): Promise<boolean> {
    const removed = await removeBookmarkApi(projectId, docSlug, anchorId)
    if (removed) {
      bookmarks.value = bookmarks.value.filter((bookmark) => !(
        bookmark.projectId === projectId
        && bookmark.docSlug === docSlug
        && sameAnchor(bookmark.anchorId, anchorId)
      ))
    }
    return removed
  }

  async function toggleBookmark(
    projectId: string,
    collectionId: string,
    docSlug: string,
    anchorId: string | null,
    titleSnapshot: string,
  ): Promise<'added' | 'removed'> {
    await ensureLoaded(projectId)
    const existing = findBookmark(projectId, docSlug, anchorId)
    if (existing) {
      await removeBookmark(projectId, docSlug, anchorId)
      return 'removed'
    }
    await upsertBookmark(projectId, collectionId, docSlug, anchorId, titleSnapshot)
    return 'added'
  }

  async function touchOpened(bookmarkId: number) {
    await touchBookmarkOpenedApi(bookmarkId)
    const bookmark = bookmarks.value.find((item) => item.id === bookmarkId)
    if (bookmark) bookmark.lastOpenedAt = Math.floor(Date.now() / 1000)
  }

  async function repairTarget(
    bookmarkId: number,
    collectionId: string,
    docSlug: string,
    anchorId: string | null,
    titleSnapshot: string,
  ) {
    const repaired = await repairBookmarkTargetApi(
      bookmarkId,
      collectionId,
      docSlug,
      anchorId,
      titleSnapshot,
    )
    const idx = bookmarks.value.findIndex((item) => item.id === bookmarkId)
    if (idx >= 0) {
      bookmarks.value[idx] = repaired
    }
    return repaired
  }

  async function createFolder(projectId: string, name: string): Promise<BookmarkFolder> {
    const folder = await createBookmarkFolderApi(projectId, name)
    folders.value.push(folder)
    folders.value.sort((a, b) => a.name.localeCompare(b.name))
    return folder
  }

  async function deleteFolder(folderId: number) {
    await deleteBookmarkFolderApi(folderId)
    folders.value = folders.value.filter((folder) => folder.id !== folderId)
    relations.value = relations.value.map((relation) => ({
      ...relation,
      folderIds: relation.folderIds.filter((id) => id !== folderId),
    }))
  }

  async function createTag(projectId: string, name: string): Promise<BookmarkTagEntity> {
    const tag = await createBookmarkTagApi(projectId, name)
    if (!tags.value.some((item) => item.id === tag.id)) {
      tags.value.push(tag)
      tags.value.sort((a, b) => a.name.localeCompare(b.name))
    }
    return tag
  }

  async function deleteTag(tagId: number) {
    await deleteBookmarkTagApi(tagId)
    tags.value = tags.value.filter((tag) => tag.id !== tagId)
    relations.value = relations.value.map((relation) => ({
      ...relation,
      tagIds: relation.tagIds.filter((id) => id !== tagId),
    }))
  }

  async function bulkDelete(projectId: string, bookmarkIds: number[]): Promise<number> {
    const deleted = await bulkDeleteBookmarksApi(projectId, bookmarkIds)
    if (deleted > 0) {
      const idSet = new Set(bookmarkIds)
      bookmarks.value = bookmarks.value.filter((bookmark) => !idSet.has(bookmark.id))
      relations.value = relations.value.filter((relation) => !idSet.has(relation.bookmarkId))
    }
    return deleted
  }

  async function bulkSetFolder(projectId: string, bookmarkIds: number[], folderId: number | null) {
    await bulkSetBookmarkFolderApi(projectId, bookmarkIds, folderId)
    const idSet = new Set(bookmarkIds)
    relations.value = relations.value.map((relation) => {
      if (!idSet.has(relation.bookmarkId)) return relation
      return { ...relation, folderIds: folderId ? [folderId] : [] }
    })
  }

  async function bulkSetTags(projectId: string, bookmarkIds: number[], tagIds: number[]) {
    await bulkSetBookmarkTagsApi(projectId, bookmarkIds, tagIds)
    const idSet = new Set(bookmarkIds)
    relations.value = relations.value.map((relation) => {
      if (!idSet.has(relation.bookmarkId)) return relation
      return { ...relation, tagIds: [...tagIds] }
    })
  }

  return {
    bookmarks,
    folders,
    tags,
    relations,
    relationByBookmarkId,
    byDocSlug,
    loading,
    loadingManagement,
    loadBookmarks,
    loadManagement,
    ensureLoaded,
    isBookmarked,
    removeBookmark,
    toggleBookmark,
    touchOpened,
    createFolder,
    deleteFolder,
    createTag,
    deleteTag,
    bulkDelete,
    bulkSetFolder,
    bulkSetTags,
    repairTarget,
  }
}
