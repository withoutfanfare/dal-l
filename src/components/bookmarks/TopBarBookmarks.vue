<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useCollections } from '@/composables/useCollections'
import { useBookmarks } from '@/composables/useBookmarks'
import { useToast } from '@/composables/useToast'
import { openBookmarkTarget } from '@/lib/bookmarkResolver'

const router = useRouter()
const { activeProjectId } = useProjects()
const { collections, activeCollectionId } = useCollections()
const { bookmarks, loadBookmarks, touchOpened, loading } = useBookmarks()
const { addToast } = useToast()

const panelOpen = ref(false)
const scope = ref<'all' | 'active'>('all')
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)

const sortedBookmarks = computed(() =>
  [...bookmarks.value].sort((a, b) => {
    const aScore = a.lastOpenedAt ?? a.updatedAt
    const bScore = b.lastOpenedAt ?? b.updatedAt
    return bScore - aScore
  }),
)

const filteredBookmarks = computed(() => {
  const trimmed = query.value.trim().toLowerCase()
  return sortedBookmarks.value.filter((bookmark) => {
    if (scope.value === 'active' && activeCollectionId.value && bookmark.collectionId !== activeCollectionId.value) {
      return false
    }
    if (!trimmed) return true
    return bookmark.titleSnapshot.toLowerCase().includes(trimmed)
      || bookmark.docSlug.toLowerCase().includes(trimmed)
      || (bookmark.anchorId ?? '').toLowerCase().includes(trimmed)
  })
})

const visibleBookmarks = computed(() => filteredBookmarks.value.slice(0, 120))

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

const currentCollectionLabel = computed(() =>
  collections.value.find((item) => item.id === activeCollectionId.value)?.name ?? 'Current folder',
)

function collectionLabel(collectionId: string): string {
  return collections.value.find((item) => item.id === collectionId)?.name ?? collectionId
}

async function openBookmark(bookmarkId: number) {
  const bookmark = bookmarks.value.find((item) => item.id === bookmarkId)
  if (!bookmark) return

  const result = await openBookmarkTarget(router, bookmark, true)
  if (result.status === 'opened') {
    panelOpen.value = false
    touchOpened(bookmark.id).catch(() => {})
    return
  }

  if (result.status === 'missing-anchor') {
    panelOpen.value = false
    touchOpened(bookmark.id).catch(() => {})
    addToast('Section moved. Opened document top.', 'info')
    return
  }

  if (result.status === 'missing-doc') {
    panelOpen.value = false
    addToast('Bookmark target moved. Opened nearest match.', 'info')
    return
  }

  addToast(result.message ?? 'Could not open bookmark', 'error')
}

function openAllBookmarksPage() {
  panelOpen.value = false
  router.push('/bookmarks').catch(() => {})
}

function openCollectionBookmarksPage(collectionId: string) {
  panelOpen.value = false
  router.push(`/bookmarks/${encodeURIComponent(collectionId)}`).catch(() => {})
}

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function onDocumentClick(event: MouseEvent) {
  if (!panelOpen.value || !rootRef.value) return
  const target = event.target as Node
  if (!rootRef.value.contains(target)) {
    panelOpen.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && panelOpen.value) {
    panelOpen.value = false
  }
}

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (!projectId) return
    loadBookmarks(projectId).catch(() => {})
  },
  { immediate: true },
)

onMounted(() => {
  window.document.addEventListener('click', onDocumentClick)
  window.document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  window.document.removeEventListener('click', onDocumentClick)
  window.document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      class="h-7 px-2.5 rounded-md text-xs font-medium transition-colors border border-border/60 bg-surface-secondary/40 text-text-secondary hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border inline-flex items-center gap-1.5"
      title="Bookmarks"
      @click="togglePanel"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 3.75H6.75A2.25 2.25 0 004.5 6v14.25l7.5-4.5 7.5 4.5V6a2.25 2.25 0 00-2.25-2.25z" />
      </svg>
      <span>Bookmarks</span>
      <span class="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-text-primary">{{ bookmarks.length }}</span>
    </button>

    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0 scale-[0.98] -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-[0.98] -translate-y-1"
    >
      <div
        v-if="panelOpen"
        class="absolute right-0 top-9 z-[120] w-[420px] max-w-[80vw] rounded-xl border border-border bg-surface shadow-2xl"
        style="-webkit-app-region: no-drag"
      >
        <div class="px-3 py-2.5 border-b border-border">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Quick bookmarks</p>
            <button
              class="text-xs text-text-secondary hover:text-text-primary"
              @click="openAllBookmarksPage"
            >
              Manage all
            </button>
          </div>

          <div class="mt-2 flex items-center gap-2">
            <button
              class="rounded px-2 py-1 text-[11px] border transition-colors"
              :class="scope === 'all' ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
              @click="scope = 'all'"
            >
              All
            </button>
            <button
              class="rounded px-2 py-1 text-[11px] border transition-colors"
              :class="scope === 'active' ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
              @click="scope = 'active'"
            >
              {{ currentCollectionLabel }}
            </button>
            <input
              v-model="query"
              type="text"
              placeholder="Filter bookmarks..."
              class="min-w-0 flex-1 rounded border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
          </div>
        </div>

        <div class="max-h-[320px] overflow-y-auto p-2">
          <div v-if="loading" class="px-2 py-4 text-xs text-text-secondary">Loading bookmarks...</div>
          <div v-else-if="filteredBookmarks.length === 0" class="px-2 py-4 text-xs text-text-secondary">
            No bookmarks match this filter.
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="bookmark in visibleBookmarks"
              :key="bookmark.id"
              class="w-full text-left rounded-md px-2 py-1.5 hover:bg-surface-secondary transition-colors"
              @click="openBookmark(bookmark.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs font-medium text-text-primary truncate">{{ bookmark.titleSnapshot }}</p>
                <span class="text-[10px] text-text-secondary flex-shrink-0">{{ collectionLabel(bookmark.collectionId) }}</span>
              </div>
              <p class="text-[11px] text-text-secondary truncate mt-0.5">
                {{ bookmark.docSlug }}<span v-if="bookmark.anchorId">#{{ bookmark.anchorId }}</span>
              </p>
            </button>
          </div>
        </div>

        <div class="px-3 py-2 border-t border-border">
          <p class="text-[11px] uppercase tracking-wider text-text-secondary mb-1.5">Collection pages</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              class="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              @click="openAllBookmarksPage"
            >
              All
            </button>
            <button
              v-for="entry in collectionCounts"
              :key="entry.collectionId"
              class="rounded-full border border-border px-2 py-0.5 text-[11px] text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              @click="openCollectionBookmarksPage(entry.collectionId)"
            >
              {{ collectionLabel(entry.collectionId) }} · {{ entry.count }}
            </button>
          </div>
          <p v-if="filteredBookmarks.length > visibleBookmarks.length" class="text-[10px] text-text-secondary mt-1.5">
            Showing first {{ visibleBookmarks.length }} matches. Use Manage all for full results.
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
