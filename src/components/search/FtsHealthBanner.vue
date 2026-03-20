<script setup lang="ts">
import { onMounted } from 'vue'
import { useFtsHealth } from '@/composables/useFtsHealth'
import { useToastStack } from '@stuntrocket/ui'

const { result, verified, rebuilding, verify, rebuild } = useFtsHealth()
const { addToast } = useToastStack()

onMounted(() => {
  verify()
})

async function handleRebuild() {
  try {
    const message = await rebuild()
    addToast(message, 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'FTS rebuild failed', 'error')
  }
}
</script>

<template>
  <div
    v-if="verified && result && !result.consistent"
    class="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-900/15 px-4 py-3 mb-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5">
        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
            Search index inconsistency detected
          </p>
          <p class="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
            {{ result.message }}
          </p>
        </div>
      </div>
      <button
        class="rounded-md border border-amber-500/40 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap"
        :disabled="rebuilding"
        @click="handleRebuild"
      >
        {{ rebuilding ? 'Rebuilding...' : 'Rebuild search index' }}
      </button>
    </div>
  </div>
</template>
