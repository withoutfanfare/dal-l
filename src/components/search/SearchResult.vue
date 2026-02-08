<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResult } from '@/lib/types'
import { sanitiseHtml } from '@/lib/sanitise'

const props = defineProps<{
  result: SearchResult
  isSelected: boolean
}>()

const safeSnippet = computed(() =>
  props.result.snippet ? sanitiseHtml(props.result.snippet) : '',
)
</script>

<template>
  <div
    class="px-4 py-2.5 cursor-pointer transition-colors"
    :class="isSelected ? 'bg-accent/8' : 'hover:bg-surface-secondary/80'"
  >
    <div class="flex items-center gap-2">
      <svg class="w-3.5 h-3.5 text-text-secondary/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <span class="font-medium text-[13px] text-text-primary truncate">{{ result.title }}</span>
      <span v-if="result.section" class="shrink-0 text-[10px] text-text-secondary/70">
        {{ result.section }}
      </span>
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -->
    <p
      v-if="result.snippet"
      class="mt-0.5 text-xs text-text-secondary/80 truncate pl-[22px]"
      v-html="safeSnippet"
    />
  </div>
</template>
