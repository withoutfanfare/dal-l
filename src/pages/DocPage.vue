<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDocument } from '@/lib/api'
import type { Document } from '@/lib/types'
import { useCollections } from '@/composables/useCollections'
import ContentHeader from '@/components/content/ContentHeader.vue'
import DocumentView from '@/components/content/DocumentView.vue'
import Breadcrumbs from '@/components/content/Breadcrumbs.vue'
import TableOfContents from '@/components/content/TableOfContents.vue'

const route = useRoute()
const router = useRouter()
const { setActiveCollection } = useCollections()

const document = ref<Document | null>(null)
const loading = ref(false)

async function fetchDocument() {
  const slug = Array.isArray(route.params.slug)
    ? route.params.slug.join('/')
    : route.params.slug

  const collection = route.params.collection as string

  if (!slug || !collection) return

  loading.value = true

  try {
    // Construct the full slug: collection/slug
    const fullSlug = `${collection}/${slug}`
    document.value = await getDocument(fullSlug)
    setActiveCollection(document.value.collection_id)

    // Update window title
    window.document.title = `${document.value.title} \u2014 dal\u012Bl`
  } catch {
    try { localStorage.removeItem('dalil:last-path') } catch { /* ignore */ }
    router.replace('/')
    return
  } finally {
    loading.value = false
  }
}

watch(
  () => [route.params.collection, route.params.slug],
  () => fetchDocument(),
  { immediate: true },
)
</script>

<template>
  <div class="flex gap-8">
    <div class="min-w-0 flex-1">
      <!-- Loading state -->
      <div v-if="loading" class="py-16 text-center text-text-secondary">
        Loading...
      </div>

      <!-- Document -->
      <template v-else-if="document">
        <Breadcrumbs :document="document" class="mb-6" />
        <ContentHeader :document="document" />
        <DocumentView :document="document" />
      </template>
    </div>

    <!-- Table of Contents (wide viewports only) -->
    <TableOfContents
      v-if="document && !loading"
      :content-key="document.slug"
    />
  </div>
</template>
