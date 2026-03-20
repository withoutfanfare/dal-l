<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SCommandPalette } from '@stuntrocket/ui'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useSearch } from '@/composables/useSearch'
import { useCollections } from '@/composables/useCollections'
import { useBookmarks } from '@/composables/useBookmarks'
import { useProjects } from '@/composables/useProjects'
import { useToastStack } from '@stuntrocket/ui'
import { buildDeepLink } from '@/lib/deepLinks'
import { getDocument } from '@/lib/api'
import SearchResultItem from '@/components/search/SearchResult.vue'
import SearchEmpty from '@/components/search/SearchEmpty.vue'

const router = useRouter()
const route = useRoute()
const { isOpen, close } = useCommandPalette()
const { query, results, loading, error, collectionFilter, clearSearch, recordSelection } = useSearch()
const { collections } = useCollections()
const { activeProjectId } = useProjects()
const { ensureLoaded, toggleBookmark } = useBookmarks()
const { addToast } = useToastStack()

const showCollectionFilters = computed(() => collections.value.length > 1)
const resultCount = computed(() => results.value.length)
const canRunDocActions = computed(() => route.name === 'doc')

function closeAndReset() {
  close()
  clearSearch()
}

function onQueryUpdate(value: string) {
  query.value = value
}

function navigateToResult(index: number) {
  const result = results.value[index]
  if (!result) return

  recordSelection(result)
  const slugWithoutCollection = result.slug.startsWith(result.collection_id + '/')
    ? result.slug.slice(result.collection_id.length + 1)
    : result.slug
  router.push({ name: 'doc', params: { collection: result.collection_id, slug: slugWithoutCollection } })
  closeAndReset()
}

function onResultClick(index: number) {
  navigateToResult(index)
}

async function bookmarkCurrentDocument() {
  try {
    if (!canRunDocActions.value || !activeProjectId.value) return
    const collection = route.params.collection as string
    const slug = Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug as string
    if (!collection || !slug) return
    const fullSlug = `${collection}/${slug}`

    const doc = await getDocument(fullSlug)
    await ensureLoaded(activeProjectId.value)
    const state = await toggleBookmark(
      activeProjectId.value,
      collection,
      fullSlug,
      null,
      doc.title,
    )
    addToast(state === 'added' ? 'Bookmark added' : 'Bookmark removed', 'success')
    closeAndReset()
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not update bookmark', 'error')
  }
}

async function copyCurrentLink() {
  try {
    if (!canRunDocActions.value || !activeProjectId.value) return
    const collection = route.params.collection as string
    const slug = Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug as string
    if (!collection || !slug) return
    const link = buildDeepLink({
      projectId: activeProjectId.value,
      collectionId: collection,
      docSlug: slug,
    })
    await navigator.clipboard.writeText(link)
    addToast('Link copied to clipboard', 'success')
    closeAndReset()
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not copy link', 'error')
  }
}

function openBookmarks() {
  router.push('/bookmarks').catch(() => {})
  closeAndReset()
}
</script>

<template>
  <SCommandPalette
    :open="isOpen"
    placeholder="Search documents..."
    :result-count="resultCount"
    @close="closeAndReset"
    @update:query="onQueryUpdate"
    @select="navigateToResult"
  >
    <template #actions>
      <!-- Quick actions -->
      <div class="flex items-center gap-1.5 px-4 py-2 border-b border-border">
        <button
          v-if="canRunDocActions"
          class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors"
          @click="bookmarkCurrentDocument"
        >
          Bookmark page
        </button>
        <button
          v-if="canRunDocActions"
          class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors"
          @click="copyCurrentLink"
        >
          Copy link
        </button>
        <button
          class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-secondary text-text-secondary hover:text-text-primary transition-colors"
          @click="openBookmarks"
        >
          Open bookmarks
        </button>
      </div>

      <!-- Collection filters -->
      <div v-if="showCollectionFilters" class="flex items-center gap-1.5 px-4 py-2 border-b border-border">
        <button
          class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
          :class="!collectionFilter
            ? 'bg-accent text-white'
            : 'bg-surface-secondary text-text-secondary hover:text-text-primary'"
          @click="collectionFilter = undefined"
        >
          All
        </button>
        <button
          v-for="col in collections"
          :key="col.id"
          class="px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors"
          :class="collectionFilter === col.id
            ? 'bg-accent text-white'
            : 'bg-surface-secondary text-text-secondary hover:text-text-primary'"
          @click="collectionFilter = col.id"
        >
          {{ col.name }}
        </button>
      </div>
    </template>

    <!-- Results -->
    <template #default="{ selectedIndex }">
      <div aria-live="polite">
        <span class="sr-only" v-if="!loading && query.trim() && !error">
          {{ results.length > 0 ? `${results.length} results found` : 'No results' }}
        </span>
        <template v-if="error">
          <div class="px-4 py-8 text-center">
            <p class="text-sm text-red-600 dark:text-red-400 mb-2">Search failed</p>
            <p class="text-xs text-text-secondary">{{ error }}</p>
          </div>
        </template>
        <template v-else-if="results.length > 0">
          <SearchResultItem
            v-for="(result, index) in results"
            :key="result.slug"
            :result="result"
            :is-selected="index === selectedIndex"
            :data-index="index"
            @click="onResultClick(index)"
          />
        </template>
        <SearchEmpty v-else :query="query" />
      </div>
    </template>
  </SCommandPalette>
</template>
