<script setup lang="ts">
import { useSourceWatcher } from '@/composables/useSourceWatcher'
import { useToastStack } from '@stuntrocket/ui'

const { changeMessage, rebuilding, triggerRebuild, dismiss } = useSourceWatcher()
const { addToast } = useToastStack()

async function handleRebuild() {
  try {
    await triggerRebuild()
    addToast('Handbook rebuilt successfully', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Rebuild failed', 'error')
  }
}
</script>

<template>
  <div
    v-if="changeMessage"
    class="mx-3 mb-2 rounded-lg border border-accent/25 bg-accent/5 px-3 py-2"
  >
    <div class="flex items-start gap-2">
      <svg class="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-medium text-accent leading-tight">
          {{ changeMessage }}
        </p>
        <div class="flex items-center gap-2 mt-1.5">
          <button
            class="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent hover:bg-accent/20 transition-colors"
            :disabled="rebuilding"
            @click="handleRebuild"
          >
            {{ rebuilding ? 'Rebuilding...' : 'Rebuild now' }}
          </button>
          <button
            class="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
            @click="dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
