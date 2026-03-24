<script setup lang="ts">
import { ref, watch } from 'vue'
import { getDocumentBacklinks } from '@/lib/api'
import type { BacklinkDocument } from '@/lib/types'

const props = defineProps<{
  slug: string
}>()

const backlinks = ref<BacklinkDocument[]>([])
const loading = ref(false)

watch(
  () => props.slug,
  async (newSlug) => {
    if (!newSlug) {
      backlinks.value = []
      return
    }
    loading.value = true
    try {
      backlinks.value = await getDocumentBacklinks(newSlug)
    } catch {
      backlinks.value = []
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function routeTo(doc: BacklinkDocument) {
  const parts = doc.slug.split('/')
  if (parts.length < 2) return `/${doc.collectionId}/${doc.slug}`
  return `/${doc.slug}`
}
</script>

<template>
  <section
    v-if="!loading && backlinks.length > 0"
    class="mt-6 border-t border-border pt-6"
  >
    <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
      Referenced by
    </h3>
    <div class="grid gap-2">
      <router-link
        v-for="doc in backlinks"
        :key="doc.slug"
        :to="routeTo(doc)"
        class="group flex items-start gap-3 rounded-lg border border-border/60 bg-surface-secondary/25 px-3.5 py-2.5 transition-colors hover:bg-surface-secondary/50"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
            {{ doc.title }}
          </p>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[11px] text-text-secondary">{{ doc.collectionName }}</span>
            <span
              v-if="doc.linkText"
              class="text-[10px] rounded-full bg-surface-secondary px-1.5 py-0.5 text-text-secondary truncate max-w-[200px]"
            >
              "{{ doc.linkText }}"
            </span>
          </div>
        </div>
        <svg class="w-4 h-4 text-text-secondary/40 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L5.5 8.5" />
        </svg>
      </router-link>
    </div>
  </section>
</template>
