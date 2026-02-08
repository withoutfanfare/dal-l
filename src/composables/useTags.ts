import { ref } from 'vue'
import { getTags } from '@/lib/api'
import type { Tag } from '@/lib/types'

const tags = ref<Tag[]>([])
const loading = ref(false)

export function useTags() {
  async function loadTags(collectionId?: string) {
    loading.value = true
    try {
      tags.value = await getTags(collectionId)
    } catch {
      tags.value = []
    } finally {
      loading.value = false
    }
  }

  return { tags, loading, loadTags }
}
