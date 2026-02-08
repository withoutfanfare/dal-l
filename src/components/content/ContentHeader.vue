<script setup lang="ts">
import { computed } from 'vue'
import type { Document } from '@/lib/types'
import TagList from '@/components/content/TagList.vue'

const props = defineProps<{
  document: Document
  tags?: string[]
}>()

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

const readingTime = computed(() => {
  const text = stripHtml(props.document.content_html)
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
})

const relativeDate = computed(() => {
  if (!props.document.last_modified) return null

  const modified = new Date(props.document.last_modified)
  const now = new Date()
  const diffMs = now.getTime() - modified.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 30) return `Updated ${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return 'Updated 1 month ago'
  if (diffMonths < 12) return `Updated ${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  if (diffYears === 1) return 'Updated 1 year ago'
  return `Updated ${diffYears} years ago`
})
</script>

<template>
  <header class="mb-8 pb-6 border-b border-border">
    <p v-if="document.section" class="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">
      {{ document.section }}
    </p>
    <h1 class="text-2xl font-semibold text-text-primary tracking-tight leading-tight m-0">
      {{ document.title }}
    </h1>
    <p class="text-sm text-stone-400 mt-2">
      <span v-if="relativeDate">{{ relativeDate }}</span>
      <span v-if="relativeDate"> &middot; </span>
      <span>{{ readingTime }} min read</span>
    </p>
    <TagList v-if="tags && tags.length > 0" :tags="tags" class="mt-3" />
  </header>
</template>
