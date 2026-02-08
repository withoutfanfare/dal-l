<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useSearch } from '@/composables/useSearch'
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation'
import SearchResultItem from '@/components/search/SearchResult.vue'
import SearchEmpty from '@/components/search/SearchEmpty.vue'

const router = useRouter()
const { isOpen, close } = useCommandPalette()
const { query, results, loading, clearSearch } = useSearch()

const inputRef = ref<HTMLInputElement | null>(null)
const resultCount = computed(() => results.value.length)

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

            <!-- Results -->
            <div class="max-h-[320px] overflow-y-auto">
              <template v-if="results.length > 0">
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
