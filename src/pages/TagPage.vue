<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTags } from '@/lib/api'
import type { Tag } from '@/lib/types'

const route = useRoute()

const tag = ref<string>('')
const tagInfo = ref<Tag | null>(null)
const loading = ref(false)

async function fetchTagInfo() {
  const tagParam = route.params.tag as string
  if (!tagParam) return

  tag.value = tagParam
  loading.value = true

  try {
    const allTags = await getTags()
    tagInfo.value = allTags.find((t) => t.tag === tagParam) ?? null
  } catch {
    tagInfo.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => route.params.tag,
  () => fetchTagInfo(),
  { immediate: true },
)
</script>

<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="py-16 text-center text-text-secondary">
      Loading...
    </div>

    <!-- Tag info -->
    <template v-else>
      <header class="mb-8">
        <router-link
          to="/"
          class="text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 inline-block"
        >
          &larr; Back to home
        </router-link>
        <h1 class="text-3xl font-bold text-text-primary tracking-tight">
          Tag: {{ tag }}
        </h1>
        <p v-if="tagInfo" class="text-text-secondary mt-2">
          {{ tagInfo.count }} {{ tagInfo.count === 1 ? 'document' : 'documents' }} tagged with "{{ tag }}"
        </p>
        <p v-else class="text-text-secondary mt-2">
          No documents found with this tag.
        </p>
      </header>

      <div class="text-sm text-text-secondary">
        <p>
          Document listing by tag requires a backend API that is not yet available.
          Use the search feature
          <kbd class="px-1.5 py-0.5 rounded bg-surface-secondary text-xs font-mono">&#8984;K</kbd>
          to find documents.
        </p>
      </div>
    </template>
  </div>
</template>
