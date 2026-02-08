<script setup lang="ts">
import { useTableOfContents } from '@/composables/useTableOfContents'
import { watch } from 'vue'

const props = defineProps<{
  contentKey?: string
}>()

const { headings, activeId, scrollToHeading, refresh } = useTableOfContents('.prose')

// Re-extract headings when the document changes
watch(
  () => props.contentKey,
  () => refresh(),
)
</script>

<template>
  <nav
    v-if="headings.length > 0"
    class="hidden 2xl:block sticky top-[68px] w-56 shrink-0 max-h-[calc(100vh-84px)] overflow-y-auto"
  >
    <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
      On this page
    </p>
    <ul class="space-y-1">
      <li
        v-for="heading in headings"
        :key="heading.id"
      >
        <button
          class="block w-full text-left text-sm leading-relaxed transition-colors truncate"
          :class="[
            heading.level === 3 ? 'pl-3' : '',
            activeId === heading.id
              ? 'text-accent font-medium'
              : 'text-text-secondary hover:text-text-primary',
          ]"
          @click="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </button>
      </li>
    </ul>
  </nav>
</template>
