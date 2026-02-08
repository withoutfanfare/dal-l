<script setup lang="ts">
import { useCollections } from '@/composables/useCollections'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'

const { collections } = useCollections()
const { open: openSearch } = useCommandPalette()
const router = useRouter()

onMounted(() => {
  document.title = 'dal\u012Bl'
})

function openCollection(collectionId: string) {
  const { setActiveCollection } = useCollections()
  setActiveCollection(collectionId)
  // Navigate to the collection root so the sidebar expands with its content
  router.push(`/${collectionId}`)
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh]">
    <div class="mb-10 text-center">
      <h1 class="text-2xl font-semibold text-text-primary tracking-tight mb-1">
        dal&#x012B;l
      </h1>
      <p class="text-sm text-text-secondary">
        Engineering handbook
      </p>
    </div>

    <!-- Search shortcut -->
    <button
      class="flex items-center gap-2 w-full max-w-sm px-3.5 py-2.5 mb-8 rounded-lg border border-border bg-surface-secondary/50 text-text-secondary text-sm transition-colors hover:border-text-secondary/30 hover:bg-surface-secondary"
      @click="openSearch"
    >
      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.5">
        <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
      </svg>
      <span class="flex-1 text-left">Search documents...</span>
      <kbd class="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] font-mono text-text-secondary">
        <span class="text-xs">&#8984;</span>K
      </kbd>
    </button>

    <!-- Collections -->
    <div
      v-if="collections.length > 0"
      class="grid gap-3 w-full"
      :class="collections.length === 1 ? 'max-w-sm' : 'grid-cols-2 max-w-xl'"
    >
      <button
        v-for="collection in collections"
        :key="collection.id"
        class="flex flex-col items-start gap-1.5 p-4 rounded-lg border border-border bg-surface hover:bg-surface-secondary/60 hover:border-text-secondary/20 transition-all text-left group"
        @click="openCollection(collection.id)"
      >
        <div class="flex items-center gap-2">
          <span v-if="collection.icon" class="text-lg">{{ collection.icon }}</span>
          <h2 class="text-sm font-semibold text-text-primary">{{ collection.name }}</h2>
        </div>
        <p v-if="collection.description" class="text-xs text-text-secondary leading-relaxed">
          {{ collection.description }}
        </p>
      </button>
    </div>

    <p v-else class="text-text-secondary text-xs">
      No collections found. Add markdown files to get started.
    </p>
  </div>
</template>
