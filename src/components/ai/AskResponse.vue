<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import type { AiProvider } from '@/lib/types'
import { sanitiseHtml } from '@/lib/sanitise'
import ProviderBadge from './ProviderBadge.vue'

const props = defineProps<{
  question: string
  response: string
  loading: boolean
  error: string | null
  provider: AiProvider | null
}>()

function renderMarkdown(text: string): string {
  if (!text) return ''

  let html = text
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // Paragraphs — double newlines
    .replace(/\n\n/g, '</p><p>')

  if (!html.startsWith('<')) {
    html = '<p>' + html + '</p>'
  }

  return sanitiseHtml(html)
}

const renderedHtml = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Debounce rendering during streaming to avoid running regex + DOMPurify on every character
watch(() => props.response, (newResponse) => {
  if (!props.loading) {
    // Not streaming — render immediately
    renderedHtml.value = renderMarkdown(newResponse)
    return
  }

  // During streaming, batch updates at ~120ms intervals
  if (debounceTimer === null) {
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      renderedHtml.value = renderMarkdown(props.response)
    }, 120)
  }
})

// Final render when streaming completes
watch(() => props.loading, (isLoading, wasLoading) => {
  if (wasLoading && !isLoading) {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    renderedHtml.value = renderMarkdown(props.response)
  }
})

onBeforeUnmount(() => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Question -->
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
        <svg class="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p class="text-sm text-text-primary leading-relaxed pt-0.5" data-selectable>{{ question }}</p>
    </div>

    <!-- Response -->
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 w-6 h-6 rounded-full bg-surface-secondary flex items-center justify-center">
        <svg class="w-3.5 h-3.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-2">
          <ProviderBadge v-if="provider" :provider="provider" />
        </div>

        <!-- Error state -->
        <div v-if="error" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
        </div>

        <!-- Loading state (no content yet) -->
        <div v-else-if="loading && !response" class="flex items-center gap-2 text-text-secondary text-sm">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Thinking...
        </div>

        <!-- Streaming / complete response -->
        <div
          v-else-if="response"
          class="prose prose-sm max-w-none text-text-primary"
          data-selectable
          v-html="renderedHtml"
        />

        <!-- Streaming indicator -->
        <span
          v-if="loading && response"
          class="inline-block w-1.5 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom"
        />
      </div>
    </div>
  </div>
</template>
