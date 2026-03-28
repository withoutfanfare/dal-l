<script setup lang="ts">
import { ref } from 'vue'
import type { DocumentSummary as DocumentSummaryType, AiProvider } from '@/lib/types'

defineProps<{
  summary: DocumentSummaryType | null
  loading: boolean
  generating: boolean
  error: string | null
  wordCount: number
}>()

const emit = defineEmits<{
  generate: [provider?: AiProvider]
}>()

const expanded = ref(true)

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    gemini: 'Gemini',
    ollama: 'Ollama',
  }
  return labels[provider] ?? provider
}
</script>

<template>
  <div class="rounded-xl border border-border/60 bg-surface/50 backdrop-blur-xl shadow-[0_14px_30px_-26px_rgba(15,23,42,0.8)] overflow-hidden">
    <button
      class="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-surface-secondary/30 transition-colors"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
        <span class="text-sm font-medium text-text-primary">Summary</span>
        <span v-if="summary" class="text-xs text-text-secondary">
          &middot; via {{ providerLabel(summary.summaryProvider) }}
        </span>
      </div>
      <svg
        class="w-4 h-4 text-text-secondary transition-transform duration-200"
        :class="{ 'rotate-180': expanded }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <div v-if="expanded" class="px-4 pb-4 border-t border-border/40">
      <!-- Cached summary -->
      <div v-if="summary" class="pt-3">
        <div class="text-sm text-text-primary leading-relaxed whitespace-pre-line">{{ summary.summary }}</div>
      </div>

      <!-- Loading cached -->
      <div v-else-if="loading" class="pt-3 flex items-center gap-2 text-sm text-text-secondary">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Checking for cached summary…
      </div>

      <!-- Generating -->
      <div v-else-if="generating" class="pt-3 flex items-center gap-2 text-sm text-text-secondary">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Generating summary…
      </div>

      <!-- Error -->
      <div v-else-if="error" class="pt-3">
        <p class="text-sm text-red-400 mb-2">{{ error }}</p>
        <button
          class="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-secondary/30 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          @click="emit('generate')"
        >
          Retry
        </button>
      </div>

      <!-- Generate prompt -->
      <div v-else class="pt-3">
        <p class="text-xs text-text-secondary mb-2">
          This document has {{ wordCount.toLocaleString() }} words. Generate an AI summary?
        </p>
        <button
          class="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
          @click="emit('generate')"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          Summarise
        </button>
      </div>
    </div>
  </div>
</template>
