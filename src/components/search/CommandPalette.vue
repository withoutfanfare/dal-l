<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useSearch } from '@/composables/useSearch'
import { useCollections } from '@/composables/useCollections'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { useBookmarks } from '@/composables/useBookmarks'
import { useProjects } from '@/composables/useProjects'
import { useToast } from '@/composables/useToast'
import { buildDeepLink } from '@/lib/deepLinks'
import { getDocument } from '@/lib/api'
import SearchResultItem from '@/components/search/SearchResult.vue'
import SearchEmpty from '@/components/search/SearchEmpty.vue'

const router = useRouter()
const route = useRoute()
const { isOpen, close } = useCommandPalette()
const { query, results, loading, error, collectionFilter, clearSearch } = useSearch()
const { collections } = useCollections()
const { activeProjectId } = useProjects()
const { ensureLoaded, toggleBookmark } = useBookmarks()
const { addToast } = useToast()

const showCollectionFilters = computed(() => collections.value.length > 1)

const inputRef = ref<HTMLInputElement | null>(null)
const paletteRef = ref<HTMLElement | null>(null)
const resultCount = computed(() => results.value.length)
const canRunDocActions = computed(() => route.name === 'doc')

useFocusTrap(paletteRef, isOpen)

function navigateToResult(index: number) {
  const result = results.value[index]
  if (!result) return

  const slugWithoutCollection = result.slug.startsWith(result.collection_id + '/')
    ? result.slug.slice(result.collection_id.length + 1)
    : result.slug
  router.push({ name: 'doc', params: { collection: result.collection_id, slug: slugWithoutCollection } })
  closeAndReset()
}

const { selectedIndex, onKeydown: onNavKeydown } = useKeyboardNavigation(resultCount, navigateToResult)

function closeAndReset() {
  close()
  clearSearch()
}

function onBackdropClick() {
  closeAndReset()
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeAndReset()
    return
  }
  onNavKeydown(e)
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

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        @click.self="onBackdropClick"
      >
        <Transition
          enter-active-class="duration-150 ease-out"
          enter-from-class="opacity-0 scale-[0.98] translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.98] translate-y-1"
        >
          <div
            v-if="isOpen"
            ref="paletteRef"
            class="mx-auto mt-[18vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-border"
          >
            <!-- Search input -->
            <div class="flex items-center gap-2.5 px-4 py-3">
              <svg
                class="h-4 w-4 shrink-0 text-text-secondary"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                  clip-rule="evenodd"
                />
              </svg>
              <input
                ref="inputRef"
                v-model="query"
                type="text"
                placeholder="Search documents..."
                class="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary/60 outline-none"
                @keydown="onInputKeydown"
              >
              <div
                v-if="loading"
                class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-text-secondary/30 border-t-text-secondary"
              />
              <kbd
                v-else
                class="hidden sm:inline-flex rounded border border-border bg-surface-secondary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary/60"
              >
                Esc
              </kbd>
            </div>

            <!-- Divider -->
            <div class="border-t border-border" />

            <!-- Collection filters -->
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

            <!-- Results -->
            <div class="max-h-[320px] overflow-y-auto" aria-live="polite">
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
                  @click="onResultClick(index)"
                />
              </template>
              <SearchEmpty v-else :query="query" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
