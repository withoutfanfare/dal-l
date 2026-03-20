import { ref, computed } from 'vue'
import {
  getCollectionProgress,
  markCollectionAllRead,
  resetCollectionProgress,
} from '@/lib/api'
import type { CollectionProgress } from '@/lib/types'

const progressList = ref<CollectionProgress[]>([])
const loading = ref(false)
const loadedProjectId = ref<string | null>(null)

export function useCollectionProgress() {
  const progressByCollection = computed(() => {
    const map = new Map<string, CollectionProgress>()
    for (const entry of progressList.value) {
      map.set(entry.collectionId, entry)
    }
    return map
  })

  async function load(projectId: string) {
    if (!projectId) {
      progressList.value = []
      loadedProjectId.value = null
      return
    }

    loading.value = true
    try {
      progressList.value = await getCollectionProgress(projectId)
      loadedProjectId.value = projectId
    } catch {
      progressList.value = []
    } finally {
      loading.value = false
    }
  }

  async function markAllRead(projectId: string, collectionId: string) {
    await markCollectionAllRead(projectId, collectionId)
    await load(projectId)
  }

  async function resetProgress(projectId: string, collectionId: string) {
    await resetCollectionProgress(projectId, collectionId)
    await load(projectId)
  }

  return {
    progressList,
    progressByCollection,
    loading,
    loadedProjectId,
    load,
    markAllRead,
    resetProgress,
  }
}
