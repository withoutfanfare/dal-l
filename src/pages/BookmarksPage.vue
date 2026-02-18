<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useBookmarks } from '@/composables/useBookmarks'
import { useCollections } from '@/composables/useCollections'
import { docSlugWithoutCollection } from '@/lib/deepLinks'
import { useToast } from '@/composables/useToast'
import { openBookmarkTarget } from '@/lib/bookmarkResolver'
import { computeVirtualRange } from '@/lib/virtualList'
import { sortBookmarksForDisplay } from '@/lib/bookmarkSort'

const router = useRouter()
const route = useRoute()
const { activeProjectId } = useProjects()
const { collections, loadCollections } = useCollections()
const {
  bookmarks,
  folders,
  tags,
  relationByBookmarkId,
  loadBookmarks,
  loadManagement,
  touchOpened,
  loading,
  loadingManagement,
  createFolder,
  deleteFolder,
  createTag,
  deleteTag,
  bulkDelete,
  bulkSetFolder,
  bulkSetTags,
  repairTarget,
} = useBookmarks()
const { addToast } = useToast()

const search = ref('')
const selectedBookmarkIds = ref<number[]>([])
const selectedCollectionFilter = ref<string | 'all'>('all')
const selectedFolderFilter = ref<number | 'all'>('all')
const selectedTagFilter = ref<number | 'all'>('all')

const newFolderName = ref('')
const newTagName = ref('')

const bulkFolderId = ref<number | 'none'>('none')
const bulkTagIds = ref<number[]>([])
const listContainer = ref<HTMLElement | null>(null)
const listScrollTop = ref(0)
const recovery = ref<{
  bookmarkId: number
  message: string
  nearestCollectionId?: string
  nearestDocSlug?: string
  nearestTitle?: string
} | null>(null)

const filteredBookmarks = computed(() => {
  const query = search.value.trim().toLowerCase()
  const filtered = bookmarks.value.filter((bookmark) => {
    if (selectedCollectionFilter.value !== 'all' && bookmark.collectionId !== selectedCollectionFilter.value) {
      return false
    }

    if (query && !(
      bookmark.titleSnapshot.toLowerCase().includes(query)
      || bookmark.docSlug.toLowerCase().includes(query)
    )) {
      return false
    }

    const relation = relationByBookmarkId.value.get(bookmark.id)

    if (selectedFolderFilter.value !== 'all') {
      if (!relation?.folderIds.includes(selectedFolderFilter.value)) {
        return false
      }
    }

    if (selectedTagFilter.value !== 'all') {
      if (!relation?.tagIds.includes(selectedTagFilter.value)) {
        return false
      }
    }

    return true
  })

  return sortBookmarksForDisplay(filtered)
})

const collectionCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const bookmark of bookmarks.value) {
    counts.set(bookmark.collectionId, (counts.get(bookmark.collectionId) ?? 0) + 1)
  }
  return Array
    .from(counts.entries())
    .map(([collectionId, count]) => ({ collectionId, count }))
    .sort((a, b) => b.count - a.count)
})

const virtualRowHeight = 126
const virtualOverscan = 10

const virtualEnabled = computed(() => filteredBookmarks.value.length > 140)

const virtualViewportHeight = computed(() =>
  listContainer.value?.clientHeight ?? 600,
)

const virtualRange = computed(() =>
  computeVirtualRange({
    totalItems: filteredBookmarks.value.length,
    scrollTop: listScrollTop.value,
    rowHeight: virtualRowHeight,
    viewportHeight: virtualViewportHeight.value,
    overscan: virtualOverscan,
  }),
)

const virtualStart = computed(() => {
  if (!virtualEnabled.value) return 0
  return virtualRange.value.start
})

const virtualEnd = computed(() => {
  if (!virtualEnabled.value) return filteredBookmarks.value.length
  return virtualRange.value.end
})

const renderedBookmarks = computed(() =>
  filteredBookmarks.value.slice(virtualStart.value, virtualEnd.value),
)

const topSpacerHeight = computed(() =>
  virtualEnabled.value ? virtualRange.value.topSpacerHeight : 0,
)

const bottomSpacerHeight = computed(() =>
  virtualEnabled.value ? virtualRange.value.bottomSpacerHeight : 0,
)

const activeCollectionLabel = computed(() => {
  if (selectedCollectionFilter.value === 'all') return 'All folders'
  return collectionName(selectedCollectionFilter.value)
})

function collectionName(collectionId: string): string {
  return collections.value.find((item) => item.id === collectionId)?.name ?? collectionId
}

function collectionRoute(collectionId: string): string {
  return `/bookmarks/${encodeURIComponent(collectionId)}`
}

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return 'Never'
  const date = new Date(unixSeconds * 1000)
  return date.toLocaleDateString()
}

async function openBookmark(bookmarkId: number) {
  const bookmark = bookmarks.value.find((item) => item.id === bookmarkId)
  if (!bookmark) return
  const result = await openBookmarkTarget(router, bookmark, false)

  if (result.status === 'opened') {
    touchOpened(bookmark.id).catch(() => {})
    recovery.value = null
    return
  }

  if (result.status === 'missing-anchor') {
    touchOpened(bookmark.id).catch(() => {})
    addToast('Section moved. Opened document top.', 'info')
    recovery.value = null
    return
  }

  if (result.status === 'missing-doc') {
    recovery.value = {
      bookmarkId,
      message: 'This bookmark target no longer exists. Choose how to recover.',
      nearestCollectionId: result.nearest?.collection_id,
      nearestDocSlug: result.nearest?.slug,
      nearestTitle: result.nearest?.title,
    }
    return
  }

  addToast(result.message ?? 'Could not open bookmark', 'error')
}

function isSelected(bookmarkId: number): boolean {
  return selectedBookmarkIds.value.includes(bookmarkId)
}

function toggleSelected(bookmarkId: number) {
  if (isSelected(bookmarkId)) {
    selectedBookmarkIds.value = selectedBookmarkIds.value.filter((id) => id !== bookmarkId)
  } else {
    selectedBookmarkIds.value = [...selectedBookmarkIds.value, bookmarkId]
  }
}

function selectAllVisible() {
  selectedBookmarkIds.value = filteredBookmarks.value.map((bookmark) => bookmark.id)
}

function clearSelection() {
  selectedBookmarkIds.value = []
}

function onListScroll(event: Event) {
  const element = event.target as HTMLElement
  listScrollTop.value = element.scrollTop
}

async function handleCreateFolder() {
  if (!activeProjectId.value || !newFolderName.value.trim()) return
  try {
    await createFolder(activeProjectId.value, newFolderName.value.trim())
    newFolderName.value = ''
    addToast('Folder created', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not create folder', 'error')
  }
}

async function handleDeleteFolder(folderId: number) {
  try {
    await deleteFolder(folderId)
    if (selectedFolderFilter.value === folderId) selectedFolderFilter.value = 'all'
    addToast('Folder deleted', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not delete folder', 'error')
  }
}

async function handleCreateTag() {
  if (!activeProjectId.value || !newTagName.value.trim()) return
  try {
    await createTag(activeProjectId.value, newTagName.value.trim())
    newTagName.value = ''
    addToast('Tag created', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not create tag', 'error')
  }
}

async function handleDeleteTag(tagId: number) {
  try {
    await deleteTag(tagId)
    if (selectedTagFilter.value === tagId) selectedTagFilter.value = 'all'
    addToast('Tag deleted', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not delete tag', 'error')
  }
}

async function handleBulkDelete() {
  if (!activeProjectId.value || selectedBookmarkIds.value.length === 0) return
  try {
    const deleted = await bulkDelete(activeProjectId.value, selectedBookmarkIds.value)
    clearSelection()
    addToast(`${deleted} bookmark(s) deleted`, 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not delete bookmarks', 'error')
  }
}

async function handleRecoveryOpenNearest() {
  const state = recovery.value
  if (!state || !state.nearestCollectionId || !state.nearestDocSlug) return
  await router.push({
    name: 'doc',
    params: {
      collection: state.nearestCollectionId,
      slug: docSlugWithoutCollection(state.nearestCollectionId, state.nearestDocSlug),
    },
  })
  recovery.value = null
}

async function handleRecoveryRepair() {
  const state = recovery.value
  if (!state || !state.nearestCollectionId || !state.nearestDocSlug) return
  try {
    await repairTarget(
      state.bookmarkId,
      state.nearestCollectionId,
      state.nearestDocSlug,
      null,
      state.nearestTitle ?? 'Recovered bookmark',
    )
    addToast('Bookmark repaired to nearest document', 'success')
    await handleRecoveryOpenNearest()
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not repair bookmark', 'error')
  }
}

async function handleRecoveryDelete() {
  const state = recovery.value
  if (!state || !activeProjectId.value) return
  const bookmark = bookmarks.value.find((item) => item.id === state.bookmarkId)
  if (!bookmark) return
  try {
    await bulkDelete(activeProjectId.value, [state.bookmarkId])
    addToast('Bookmark deleted', 'success')
    recovery.value = null
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not delete bookmark', 'error')
  }
}

async function handleBulkSetFolder() {
  if (!activeProjectId.value || selectedBookmarkIds.value.length === 0) return
  try {
    const folderId = bulkFolderId.value === 'none' ? null : bulkFolderId.value
    await bulkSetFolder(activeProjectId.value, selectedBookmarkIds.value, folderId)
    addToast('Folder assignment updated', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not update folder assignment', 'error')
  }
}

async function handleBulkSetTags() {
  if (!activeProjectId.value || selectedBookmarkIds.value.length === 0) return
  try {
    await bulkSetTags(activeProjectId.value, selectedBookmarkIds.value, bulkTagIds.value)
    addToast('Tag assignment updated', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not update tags', 'error')
  }
}

function folderName(folderId: number): string {
  return folders.value.find((folder) => folder.id === folderId)?.name ?? 'Folder'
}

function tagName(tagId: number): string {
  return tags.value.find((tag) => tag.id === tagId)?.name ?? 'Tag'
}

function setCollectionFilterFromRoute() {
  const routeCollection = route.params.collection
  const value = Array.isArray(routeCollection) ? routeCollection[0] : routeCollection
  selectedCollectionFilter.value = value ?? 'all'
}

function pushCollectionRoute(value: string | 'all') {
  const target = value === 'all'
    ? '/bookmarks'
    : `/bookmarks/${encodeURIComponent(value)}`
  if (route.fullPath === target) return
  router.replace(target).catch(() => {})
}

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (projectId) {
      loadBookmarks(projectId).catch(() => {})
      loadManagement(projectId).catch(() => {})
      clearSelection()
    }
  },
  { immediate: true },
)

watch(
  () => route.params.collection,
  () => setCollectionFilterFromRoute(),
  { immediate: true },
)

watch(
  () => selectedCollectionFilter.value,
  (value) => {
    pushCollectionRoute(value)
  },
)

onMounted(() => {
  loadCollections().catch(() => {})
  if (activeProjectId.value) {
    loadBookmarks(activeProjectId.value).catch(() => {})
    loadManagement(activeProjectId.value).catch(() => {})
  }
})
</script>

<template>
  <div>
    <header class="mb-6 flex items-start justify-between gap-4">
      <div>
        <router-link
          to="/"
          class="text-sm text-text-secondary hover:text-text-primary transition-colors mb-3 inline-block"
        >
          &larr; Back to home
        </router-link>
        <h1 class="text-3xl font-bold text-text-primary tracking-tight">Bookmarks</h1>
        <p class="text-text-secondary mt-1">
          {{ activeCollectionLabel }}: saved pages and sections with folders, tags, and bulk management.
        </p>
      </div>
    </header>

    <div class="mb-4 flex flex-wrap items-center gap-1.5">
      <router-link
        to="/bookmarks"
        class="rounded-full border px-2 py-0.5 text-xs transition-colors"
        :class="selectedCollectionFilter === 'all'
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
      >
        All
      </router-link>
      <router-link
        v-for="entry in collectionCounts"
        :key="entry.collectionId"
        :to="collectionRoute(entry.collectionId)"
        class="rounded-full border px-2 py-0.5 text-xs transition-colors"
        :class="selectedCollectionFilter === entry.collectionId
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
      >
        {{ collectionName(entry.collectionId) }} · {{ entry.count }}
      </router-link>
    </div>

    <div
      v-if="recovery"
      class="mb-4 rounded-lg border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700/60 p-3"
    >
      <p class="text-sm text-amber-900 dark:text-amber-200">{{ recovery.message }}</p>
      <p v-if="recovery.nearestTitle" class="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
        Nearest match: {{ recovery.nearestTitle }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2">
        <button
          class="rounded bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
          :disabled="!recovery.nearestDocSlug"
          @click="handleRecoveryRepair"
        >
          Repair bookmark
        </button>
        <button
          class="rounded border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-900/40"
          :disabled="!recovery.nearestDocSlug"
          @click="handleRecoveryOpenNearest"
        >
          Open nearest
        </button>
        <button
          class="rounded border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/40"
          @click="handleRecoveryDelete"
        >
          Delete bookmark
        </button>
      </div>
    </div>

    <div class="mb-4 grid gap-3 md:grid-cols-4">
      <input
        v-model="search"
        type="text"
        placeholder="Filter bookmarks..."
        class="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent md:col-span-2"
      >
      <select
        v-model="selectedCollectionFilter"
        class="ui-select text-sm"
      >
        <option value="all">All folders</option>
        <option v-for="collection in collections" :key="collection.id" :value="collection.id">
          {{ collection.name }}
        </option>
      </select>
      <div class="flex items-center gap-2 md:col-span-1">
        <select
          v-model="selectedFolderFilter"
          class="ui-select flex-1 text-sm"
        >
          <option value="all">All folders</option>
          <option v-for="folder in folders" :key="folder.id" :value="folder.id">
            {{ folder.name }}
          </option>
        </select>
        <select
          v-model="selectedTagFilter"
          class="ui-select flex-1 text-sm"
        >
          <option value="all">All tags</option>
          <option v-for="tag in tags" :key="tag.id" :value="tag.id">
            {{ tag.name }}
          </option>
        </select>
      </div>
    </div>

    <div class="mb-5 grid gap-3 md:grid-cols-2">
      <div class="rounded-lg border border-border bg-surface p-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Folders</p>
        <div class="flex gap-2 mb-2">
          <input
            v-model="newFolderName"
            type="text"
            placeholder="New folder name"
            class="flex-1 rounded border border-border bg-surface-secondary px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            @keydown.enter="handleCreateFolder"
          >
          <button
            class="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
            @click="handleCreateFolder"
          >
            Add
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="folder in folders"
            :key="folder.id"
            class="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1 text-xs text-text-primary"
          >
            {{ folder.name }}
            <button class="text-text-secondary hover:text-text-primary" @click="handleDeleteFolder(folder.id)">×</button>
          </span>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-surface p-3">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Tags</p>
        <div class="flex gap-2 mb-2">
          <input
            v-model="newTagName"
            type="text"
            placeholder="New tag name"
            class="flex-1 rounded border border-border bg-surface-secondary px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            @keydown.enter="handleCreateTag"
          >
          <button
            class="rounded bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
            @click="handleCreateTag"
          >
            Add
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in tags"
            :key="tag.id"
            class="inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-1 text-xs text-text-primary"
          >
            {{ tag.name }}
            <button class="text-text-secondary hover:text-text-primary" @click="handleDeleteTag(tag.id)">×</button>
          </span>
        </div>
      </div>
    </div>

    <div v-if="loading || loadingManagement" class="text-sm text-text-secondary py-6">
      Loading bookmarks...
    </div>

    <div v-else-if="filteredBookmarks.length === 0" class="text-sm text-text-secondary py-8 text-center">
      No bookmarks yet for this project.
    </div>

    <div v-else>
      <div class="mb-3 rounded-lg border border-border bg-surface p-3">
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            @click="selectAllVisible"
          >
            Select visible
          </button>
          <button
            class="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            @click="clearSelection"
          >
            Clear selection
          </button>
          <span class="text-xs text-text-secondary">
            {{ selectedBookmarkIds.length }} selected
          </span>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <select
            v-model="bulkFolderId"
            class="ui-select ui-select-sm text-xs"
          >
            <option value="none">No folder</option>
            <option v-for="folder in folders" :key="folder.id" :value="folder.id">
              {{ folder.name }}
            </option>
          </select>
          <button
            class="rounded bg-surface-secondary px-2 py-1.5 text-xs text-text-primary hover:bg-border transition-colors"
            :disabled="selectedBookmarkIds.length === 0"
            @click="handleBulkSetFolder"
          >
            Apply folder
          </button>
          <select
            v-model="bulkTagIds"
            multiple
            class="ui-select min-w-[180px] text-xs"
          >
            <option v-for="tag in tags" :key="tag.id" :value="tag.id">
              {{ tag.name }}
            </option>
          </select>
          <button
            class="rounded bg-surface-secondary px-2 py-1.5 text-xs text-text-primary hover:bg-border transition-colors"
            :disabled="selectedBookmarkIds.length === 0"
            @click="handleBulkSetTags"
          >
            Apply tags
          </button>
          <button
            class="rounded bg-red-600 px-2 py-1.5 text-xs text-white hover:bg-red-500 transition-colors"
            :disabled="selectedBookmarkIds.length === 0"
            @click="handleBulkDelete"
          >
            Delete selected
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <div
          v-if="virtualEnabled"
          ref="listContainer"
          class="max-h-[64vh] overflow-y-auto rounded-lg border border-border bg-surface p-2"
          @scroll="onListScroll"
        >
          <div :style="{ height: `${topSpacerHeight}px` }" />
          <div class="space-y-2">
            <div
              v-for="bookmark in renderedBookmarks"
              :key="bookmark.id"
              class="rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-secondary/70 min-h-[110px]"
            >
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-1"
                  :checked="isSelected(bookmark.id)"
                  @change="toggleSelected(bookmark.id)"
                >
                <button class="flex-1 text-left" @click="openBookmark(bookmark.id)">
                  <p class="text-sm font-medium text-text-primary">{{ bookmark.titleSnapshot }}</p>
                  <p class="text-xs text-text-secondary mt-1 truncate">
                    {{ bookmark.docSlug }}<span v-if="bookmark.anchorId">#{{ bookmark.anchorId }}</span>
                  </p>
                  <p class="text-[11px] text-text-secondary/80 mt-1">
                    {{ collectionName(bookmark.collectionId) }}
                  </p>
                  <p class="text-[11px] text-text-secondary/80 mt-1">
                    Last opened: {{ formatDate(bookmark.lastOpenedAt) }}
                  </p>
                  <p class="text-[11px] text-text-secondary/70 mt-1">
                    Opened {{ bookmark.openCount }} times
                  </p>
                </button>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-1.5 ml-7">
                <span
                  v-for="folderId in (relationByBookmarkId.get(bookmark.id)?.folderIds ?? [])"
                  :key="`folder-${bookmark.id}-${folderId}`"
                  class="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px]"
                >
                  {{ folderName(folderId) }}
                </span>
                <span
                  v-for="tagId in (relationByBookmarkId.get(bookmark.id)?.tagIds ?? [])"
                  :key="`tag-${bookmark.id}-${tagId}`"
                  class="rounded-full bg-surface-secondary text-text-secondary px-2 py-0.5 text-[11px]"
                >
                  #{{ tagName(tagId) }}
                </span>
              </div>
            </div>
          </div>
          <div :style="{ height: `${bottomSpacerHeight}px` }" />
        </div>

        <template v-else>
        <div
          v-for="bookmark in renderedBookmarks"
          :key="bookmark.id"
          class="rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-secondary/70"
        >
          <div class="flex items-start gap-3">
            <input
              type="checkbox"
              class="mt-1"
              :checked="isSelected(bookmark.id)"
              @change="toggleSelected(bookmark.id)"
            >
            <button class="flex-1 text-left" @click="openBookmark(bookmark.id)">
              <p class="text-sm font-medium text-text-primary">{{ bookmark.titleSnapshot }}</p>
              <p class="text-xs text-text-secondary mt-1 truncate">
                {{ bookmark.docSlug }}<span v-if="bookmark.anchorId">#{{ bookmark.anchorId }}</span>
              </p>
              <p class="text-[11px] text-text-secondary/80 mt-1">
                {{ collectionName(bookmark.collectionId) }}
              </p>
              <p class="text-[11px] text-text-secondary/80 mt-1">
                Last opened: {{ formatDate(bookmark.lastOpenedAt) }}
              </p>
              <p class="text-[11px] text-text-secondary/70 mt-1">
                Opened {{ bookmark.openCount }} times
              </p>
            </button>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-1.5 ml-7">
            <span
              v-for="folderId in (relationByBookmarkId.get(bookmark.id)?.folderIds ?? [])"
              :key="`folder-${bookmark.id}-${folderId}`"
              class="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px]"
            >
              {{ folderName(folderId) }}
            </span>
            <span
              v-for="tagId in (relationByBookmarkId.get(bookmark.id)?.tagIds ?? [])"
              :key="`tag-${bookmark.id}-${tagId}`"
              class="rounded-full bg-surface-secondary text-text-secondary px-2 py-0.5 text-[11px]"
            >
              #{{ tagName(tagId) }}
            </span>
          </div>
        </div>
        </template>
      </div>
    </div>
  </div>
</template>
