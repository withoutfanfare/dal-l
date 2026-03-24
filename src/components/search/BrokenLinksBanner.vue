<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getBrokenLinks } from '@/lib/api'
import type { BrokenLinkEntry } from '@/lib/types'

const brokenLinks = ref<BrokenLinkEntry[]>([])
const loaded = ref(false)
const expanded = ref(false)

onMounted(async () => {
  try {
    brokenLinks.value = await getBrokenLinks()
  } catch {
    brokenLinks.value = []
  } finally {
    loaded.value = true
  }
})

function routeTo(link: BrokenLinkEntry) {
  const parts = link.sourceSlug.split('/')
  if (parts.length < 2) return `/${link.collectionId}/${link.sourceSlug}`
  return `/${link.sourceSlug}`
}
</script>

<template>
  <div
    v-if="loaded && brokenLinks.length > 0"
    class="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 mb-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5">
        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L5.5 8.5" />
        </svg>
        <div>
          <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
            {{ brokenLinks.length }} broken internal link{{ brokenLinks.length === 1 ? '' : 's' }} detected
          </p>
          <p class="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
            Some internal links point to documents that no longer exist.
          </p>
        </div>
      </div>
      <button
        class="rounded-md border border-amber-500/40 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide' : 'Show' }}
      </button>
    </div>
    <div v-if="expanded" class="mt-3 space-y-1.5">
      <div
        v-for="(link, idx) in brokenLinks"
        :key="idx"
        class="flex items-center gap-2 text-xs"
      >
        <router-link
          :to="routeTo(link)"
          class="text-amber-800 dark:text-amber-300 hover:underline truncate max-w-[200px]"
        >
          {{ link.sourceTitle }}
        </router-link>
        <span class="text-amber-600/60 dark:text-amber-500/50">&rarr;</span>
        <span class="text-amber-700/70 dark:text-amber-400/60 truncate max-w-[200px] font-mono">
          {{ link.targetUrl }}
        </span>
      </div>
    </div>
  </div>
</template>
