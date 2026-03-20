import { ref } from 'vue'
import { getRelatedDocuments } from '@/lib/api'
import type { RelatedDocument } from '@/lib/types'

const relatedDocs = ref<RelatedDocument[]>([])
const loading = ref(false)
const dismissedKeys = new Set<string>()

function dismissKey(docSlug: string, relatedSlug: string): string {
  return `${docSlug}::${relatedSlug}`
}

export function useRelatedDocs() {
  async function load(slug: string, limit?: number) {
    loading.value = true
    try {
      const docs = await getRelatedDocuments(slug, limit)
      relatedDocs.value = docs.filter(
        (doc) => !dismissedKeys.has(dismissKey(slug, doc.slug)),
      )
    } catch {
      relatedDocs.value = []
    } finally {
      loading.value = false
    }
  }

  function dismiss(docSlug: string, relatedSlug: string) {
    dismissedKeys.add(dismissKey(docSlug, relatedSlug))
    relatedDocs.value = relatedDocs.value.filter(
      (doc) => doc.slug !== relatedSlug,
    )
  }

  function clear() {
    relatedDocs.value = []
  }

  return { relatedDocs, loading, load, dismiss, clear }
}
