<script setup lang="ts">
import { computed } from 'vue'
import type { Document } from '@/lib/types'
import { useCollections } from '@/composables/useCollections'
import { useNavigation } from '@/composables/useNavigation'

const props = defineProps<{
  document: Document
}>()

const { activeCollection } = useCollections()
const { findSectionSlug } = useNavigation()

const segments = computed(() => {
  const crumbs: { label: string; to: string | null }[] = []

  if (activeCollection.value) {
    crumbs.push({
      label: activeCollection.value.name,
      to: `/${props.document.collection_id}`,
    })
  }

  if (props.document.section) {
    const sectionSlug = findSectionSlug(props.document.section)
    const fallbackParent = props.document.parent_slug?.trim()
    const targetSlug = sectionSlug ?? (fallbackParent && fallbackParent !== props.document.slug ? fallbackParent : null)
    crumbs.push({
      label: props.document.section,
      to: targetSlug ? `/${props.document.collection_id}/${targetSlug}` : `/${props.document.collection_id}`,
    })
  }

  crumbs.push({
    label: props.document.title,
    to: null,
  })

  return crumbs
})
</script>

<template>
  <nav class="flex items-center gap-1 text-xs text-text-secondary">
    <template v-for="(segment, index) in segments" :key="index">
      <svg v-if="index > 0" class="w-3 h-3 text-text-secondary/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <router-link
        v-if="segment.to"
        :to="segment.to"
        class="hover:text-text-primary transition-colors"
      >
        {{ segment.label }}
      </router-link>
      <span
        v-else
        :class="index === segments.length - 1 ? 'text-text-primary font-medium' : ''"
        class="truncate max-w-[200px]"
      >
        {{ segment.label }}
      </span>
    </template>
  </nav>
</template>
