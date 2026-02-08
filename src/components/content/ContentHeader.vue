<script setup lang="ts">
import type { Document } from '@/lib/types'
import TagList from '@/components/content/TagList.vue'

defineProps<{
  document: Document
  tags?: string[]
}>()
</script>

<template>
  <header class="mb-8 pb-6 border-b border-border">
    <p v-if="document.section" class="text-xs font-medium uppercase tracking-wider text-text-secondary mb-2">
      {{ document.section }}
    </p>
    <h1 class="text-2xl font-semibold text-text-primary tracking-tight leading-tight m-0">
      {{ document.title }}
    </h1>
    <TagList v-if="tags && tags.length > 0" :tags="tags" class="mt-3" />
  </header>
</template>
