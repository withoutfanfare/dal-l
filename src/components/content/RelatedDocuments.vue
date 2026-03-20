<script setup lang="ts">
import { watch } from 'vue'
import { useRelatedDocs } from '@/composables/useRelatedDocs'
import type { RelatedDocument } from '@/lib/types'

const props = defineProps<{
  slug: string
}>()

const { relatedDocs, loading, load, dismiss } = useRelatedDocs()

watch(
  () => props.slug,
  (newSlug) => {
    if (newSlug) load(newSlug, 5)
  },
  { immediate: true },
)

function routeTo(doc: RelatedDocument) {
  const parts = doc.slug.split('/')
  if (parts.length < 2) return `/${doc.collectionId}/${doc.slug}`
  return `/${doc.slug}`
}
</script>

<template>
  <section
    v-if="!loading && relatedDocs.length > 0"
    class="mt-10 border-t border-border pt-6"
  >
    <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
      Related documents
    </h3>
    <div class="grid gap-2">
      <div
        v-for="doc in relatedDocs"
        :key="doc.slug"
        class="group flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-surface-secondary/25 px-3.5 py-2.5 transition-colors hover:bg-surface-secondary/50"
      >
        <router-link
          :to="routeTo(doc)"
          class="flex-1 min-w-0"
        >
          <p class="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
            {{ doc.title }}
          </p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[11px] text-text-secondary">{{ doc.collectionName }}</span>
            <span class="text-[10px] rounded-full bg-surface-secondary px-1.5 py-0.5 text-text-secondary">
              {{ doc.relevance }}
            </span>
          </div>
        </router-link>
        <button
          class="mt-0.5 text-[10px] text-text-secondary/60 hover:text-text-secondary transition-colors opacity-0 group-hover:opacity-100"
          title="Dismiss suggestion"
          @click.prevent="dismiss(slug, doc.slug)"
        >
          Dismiss
        </button>
      </div>
    </div>
  </section>
</template>
