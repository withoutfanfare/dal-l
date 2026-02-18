<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useCollections } from '@/composables/useCollections'
import { useDocActivity } from '@/composables/useDocActivity'
import { useBookmarks } from '@/composables/useBookmarks'
import { useDocTabs } from '@/composables/useDocTabs'
import { searchDocuments } from '@/lib/api'
import type { SearchResult } from '@/lib/types'
import { docSlugWithoutCollection } from '@/lib/deepLinks'
import { sortBookmarksForDisplay } from '@/lib/bookmarkSort'

const route = useRoute()
const router = useRouter()

const { activeProjectId } = useProjects()
const { collections, activeCollectionId } = useCollections()
const { recentDocuments, load: loadActivity } = useDocActivity()
const { bookmarks, ensureLoaded } = useBookmarks()
const {
  beginNewTab,
  isNewTabPending,
  cancelNewTab,
  getActiveSlug,
  getTabs,
} = useDocTabs()

const query = ref('')
const searching = ref(false)
const searchResults = ref<SearchResult[]>([])
const selectedCollection = ref<string | 'all'>('all')
const searchError = ref<string | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestId = 0

const routeCollection = computed(() => {
  const raw = route.params.collection
  const value = Array.isArray(raw) ? raw[0] : raw
  return value || activeCollectionId.value || ''
})

const projectKey = computed(() => activeProjectId.value || 'default')
const newTabPending = computed(() =>
  !!routeCollection.value && isNewTabPending(projectKey.value, routeCollection.value),
)
const openTabs = computed(() => {
  if (!routeCollection.value) return []
  return getTabs(projectKey.value, routeCollection.value)
})
const hasOpenTabs = computed(() => openTabs.value.length > 0)
const returnTabSlug = computed(() => {
  if (!routeCollection.value || openTabs.value.length === 0) return null
  const activeSlug = getActiveSlug(projectKey.value, routeCollection.value)
  if (activeSlug && openTabs.value.some((tab) => tab.slug === activeSlug)) {
    return activeSlug
  }
  return openTabs.value[0]?.slug ?? null
})
const cancelLabel = computed(() => {
  if (newTabPending.value) return 'Exit new tab mode'
  return 'Back to current tab'
})
const showCancelAction = computed(() => newTabPending.value || hasOpenTabs.value)

const collectionName = computed(() =>
  collections.value.find((item) => item.id === routeCollection.value)?.name ?? routeCollection.value,
)

const topRecent = computed(() =>
  recentDocuments.value
    .filter((item) => !routeCollection.value || item.collectionId === routeCollection.value)
    .slice(0, 8),
)

const topBookmarks = computed(() =>
  sortBookmarksForDisplay(bookmarks.value)
    .filter((item) => !routeCollection.value || item.collectionId === routeCollection.value)
    .slice(0, 8),
)

function formatQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const terms = trimmed.split(/\s+/)
  const last = terms.pop()!
  terms.push(`${last}*`)
  return terms.join(' ')
}

function openDoc(collectionId: string, docSlug: string) {
  router.push({
    name: 'doc',
    params: {
      collection: collectionId,
      slug: docSlugWithoutCollection(collectionId, docSlug),
    },
  }).catch(() => {})
}

function startNewTabMode() {
  if (!routeCollection.value) return
  beginNewTab(projectKey.value, routeCollection.value)
}

function cancelNewTabMode() {
  if (routeCollection.value) {
    cancelNewTab(projectKey.value, routeCollection.value)
  }
  const from = typeof route.query.from === 'string' ? route.query.from : null
  if (from) {
    const resolved = router.resolve(from)
    if (resolved.matched.length > 0 && resolved.name === 'doc') {
      router.push(from).catch(() => {})
      return
    }
  }
  if (routeCollection.value && returnTabSlug.value) {
    router.push({
      name: 'doc',
      params: {
        collection: routeCollection.value,
        slug: returnTabSlug.value,
      },
    }).catch(() => {})
    return
  }
  if (routeCollection.value) {
    router.replace({
      name: 'springboard',
      params: { collection: routeCollection.value },
    }).catch(() => {})
    return
  }
  router.replace({ name: 'springboard' }).catch(() => {})
}

async function runSearch() {
  const trimmed = query.value.trim()
  if (!trimmed) {
    searchResults.value = []
    searching.value = false
    searchError.value = null
    return
  }

  searching.value = true
  searchError.value = null
  const thisRequest = ++searchRequestId
  try {
    const collectionFilter = selectedCollection.value === 'all'
      ? undefined
      : selectedCollection.value
    const results = await searchDocuments(formatQuery(trimmed), collectionFilter, 12)
    if (thisRequest === searchRequestId) {
      searchResults.value = results
    }
  } catch (e) {
    if (thisRequest === searchRequestId) {
      searchResults.value = []
      searchError.value = e instanceof Error ? e.message : String(e)
    }
  } finally {
    if (thisRequest === searchRequestId) {
      searching.value = false
    }
  }
}

watch(
  () => query.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      runSearch().catch(() => {})
    }, 140)
  },
)

watch(
  () => selectedCollection.value,
  () => {
    runSearch().catch(() => {})
  },
)

onMounted(async () => {
  document.title = 'New Tab · dal\u012Bl'
  if (routeCollection.value) {
    selectedCollection.value = routeCollection.value
  }
  if (activeProjectId.value) {
    await Promise.all([
      loadActivity(activeProjectId.value),
      ensureLoaded(activeProjectId.value),
    ]).catch(() => {})
  }
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <header class="mb-6 rounded-xl border border-border bg-surface p-5">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">New tab</p>
      <h1 class="mt-1 text-xl font-semibold text-text-primary">Choose a document for your next tab</h1>
      <p class="mt-1 text-sm text-text-secondary">
        Use search, recent pages, or bookmarks{{ collectionName ? ` in ${collectionName}` : '' }}.
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-medium leading-none"
          :class="newTabPending
            ? 'bg-accent/12 text-accent border-accent/35 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.09)]'
            : 'bg-surface-secondary/72 text-text-secondary border-border/80'"
        >
          {{ newTabPending ? 'New tab mode active' : 'New tab mode paused' }}
        </span>
        <button
          v-if="!newTabPending"
          class="inline-flex h-7 items-center rounded-md border border-border px-3 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          @click="startNewTabMode"
        >
          Start new tab mode
        </button>
        <button
          v-if="showCancelAction"
          class="inline-flex h-7 items-center rounded-md border border-border px-3 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          @click="cancelNewTabMode"
        >
          {{ cancelLabel }}
        </button>
      </div>
      <p v-if="!hasOpenTabs" class="mt-2 text-xs text-text-secondary/85">
        No open tabs yet in this folder. The springboard stays open until you choose a document.
      </p>
    </header>

    <section class="mb-6 rounded-xl border border-border bg-surface p-4">
      <div class="flex flex-wrap items-center gap-2">
        <input
          v-model="query"
          type="text"
          placeholder="Search documents..."
          class="min-w-[220px] flex-1 rounded-lg border border-border bg-surface-secondary/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
        <select
          v-model="selectedCollection"
          class="ui-select ui-select-sm min-w-[150px] text-xs text-text-secondary"
        >
          <option value="all">All folders</option>
          <option v-for="collection in collections" :key="collection.id" :value="collection.id">
            {{ collection.name }}
          </option>
        </select>
      </div>

      <div class="mt-3">
        <p v-if="searching" class="text-xs text-text-secondary">Searching…</p>
        <p v-else-if="searchError" class="text-xs text-red-500">{{ searchError }}</p>
        <div v-else-if="searchResults.length > 0" class="space-y-1.5">
          <button
            v-for="result in searchResults"
            :key="result.slug"
            class="w-full rounded-md border border-border/70 bg-surface-secondary/20 px-3 py-2 text-left transition-colors duration-150 hover:border-border hover:bg-surface-secondary/58 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
            @click="openDoc(result.collection_id, result.slug)"
          >
            <p class="text-sm font-medium text-text-primary truncate">{{ result.title }}</p>
            <p class="mt-0.5 text-[11px] text-text-secondary truncate">{{ result.collection_id }} · {{ result.section || result.slug }}</p>
          </button>
        </div>
        <p v-else-if="query.trim().length > 0" class="text-xs text-text-secondary">No matches yet.</p>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Recent</h2>
        </div>
        <div v-if="topRecent.length === 0" class="text-xs text-text-secondary py-2">No recent pages.</div>
        <div v-else class="space-y-1.5">
          <button
            v-for="item in topRecent"
            :key="`recent-${item.docSlug}`"
            class="w-full rounded-md border border-border/70 bg-surface-secondary/20 px-3 py-2 text-left transition-colors duration-150 hover:border-border hover:bg-surface-secondary/58 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
            @click="openDoc(item.collectionId, item.docSlug)"
          >
            <p class="text-sm font-medium text-text-primary truncate">{{ item.title }}</p>
            <p class="mt-0.5 text-[11px] text-text-secondary truncate">{{ item.collectionId }} · {{ item.section || item.docSlug }}</p>
          </button>
        </div>
      </section>

      <section class="rounded-xl border border-border bg-surface p-4">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Bookmarks</h2>
          <router-link to="/bookmarks" class="text-[11px] text-text-secondary hover:text-text-primary transition-colors">
            Manage
          </router-link>
        </div>
        <div v-if="topBookmarks.length === 0" class="text-xs text-text-secondary py-2">No bookmarks yet.</div>
        <div v-else class="space-y-1.5">
          <button
            v-for="bookmark in topBookmarks"
            :key="`bookmark-${bookmark.id}`"
            class="w-full rounded-md border border-border/70 bg-surface-secondary/20 px-3 py-2 text-left transition-colors duration-150 hover:border-border hover:bg-surface-secondary/58 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
            @click="openDoc(bookmark.collectionId, bookmark.docSlug)"
          >
            <p class="text-sm font-medium text-text-primary truncate">{{ bookmark.titleSnapshot }}</p>
            <p class="mt-0.5 text-[11px] text-text-secondary truncate">
              {{ bookmark.collectionId }} · {{ bookmark.docSlug }}<span v-if="bookmark.anchorId">#{{ bookmark.anchorId }}</span>
            </p>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
