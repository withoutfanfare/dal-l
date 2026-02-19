<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTags, getDocumentsByTag } from '@/lib/api'
import type { Tag, SearchResult } from '@/lib/types'

const route = useRoute()
const router = useRouter()

const tag = ref<string>('')
const tagInfo = ref<Tag | null>(null)
const documents = ref<SearchResult[]>([])
const loading = ref(false)
let requestId = 0

async function fetchTagData() {
  const thisRequest = ++requestId
  const tagParam = route.params.tag as string
  if (!tagParam) return

  tag.value = tagParam
  loading.value = true

  try {
    const [allTags, docs] = await Promise.all([
      getTags(),
      getDocumentsByTag(tagParam),
    ])
    if (thisRequest !== requestId) return
    tagInfo.value = allTags.find((t) => t.tag === tagParam) ?? null
    documents.value = docs
  } catch {
    if (thisRequest === requestId) {
      tagInfo.value = null
      documents.value = []
    }
  } finally {
    if (thisRequest === requestId) {
      loading.value = false
    }
  }
}

function navigateToDocument(slug: string) {
  router.push(`/${slug}`)
}

watch(
  () => route.params.tag,
  () => fetchTagData(),
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
      </header>

      <!-- Document list -->
      <div v-if="documents.length > 0" class="space-y-2">
        <button
          v-for="doc in documents"
          :key="doc.slug"
          class="w-full text-left px-4 py-3 rounded-lg bg-surface-primary hover:bg-surface-secondary transition-colors group"
          @click="navigateToDocument(doc.slug)"
        >
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">
                {{ doc.title }}
              </p>
              <p v-if="doc.section" class="text-xs text-text-secondary mt-0.5 truncate">
                {{ doc.section }}
              </p>
            </div>
            <span class="shrink-0 text-xs px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary">
              {{ doc.collection_id }}
            </span>
          </div>
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="!loading" class="py-12 text-center text-text-secondary">
        <p>No documents tagged with "{{ tag }}".</p>
      </div>
    </template>
  </div>
</template>
