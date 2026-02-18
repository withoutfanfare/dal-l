import { computed, ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import {
  getRecentDocuments as getRecentDocumentsApi,
  getUpdatedDocuments as getUpdatedDocumentsApi,
  markDocumentViewed as markDocumentViewedApi,
} from '@/lib/api'
import type { DocActivityItem } from '@/lib/types'

const recentDocuments = ref<DocActivityItem[]>([])
const updatedDocuments = ref<DocActivityItem[]>([])
const loading = ref(false)
const loadedProjectId = ref<string | null>(null)
let buildListenerAttached = false

export function useDocActivity() {
  const updatedSlugs = computed(() => new Set(updatedDocuments.value.map((item) => item.docSlug)))

  async function load(projectId: string) {
    if (!projectId) {
      recentDocuments.value = []
      updatedDocuments.value = []
      loadedProjectId.value = null
      return
    }

    loading.value = true
    try {
      const [recent, updated] = await Promise.all([
        getRecentDocumentsApi(projectId, 8),
        getUpdatedDocumentsApi(projectId, 30),
      ])
      recentDocuments.value = recent
      updatedDocuments.value = updated
      loadedProjectId.value = projectId
    } finally {
      loading.value = false
    }
  }

  async function refresh(projectId: string) {
    await load(projectId)
  }

  async function markViewed(projectId: string, docSlug: string) {
    await markDocumentViewedApi(projectId, docSlug)
    updatedDocuments.value = updatedDocuments.value.filter((item) => item.docSlug !== docSlug)

    const existingIndex = recentDocuments.value.findIndex((item) => item.docSlug === docSlug)
    if (existingIndex >= 0) {
      const [existing] = recentDocuments.value.splice(existingIndex, 1)
      recentDocuments.value.unshift({
        ...existing,
        lastViewedAt: Math.floor(Date.now() / 1000),
        updatedSinceViewed: false,
      })
    }
  }

  if (!buildListenerAttached) {
    buildListenerAttached = true
    listen<{ projectId: string }>('project-build-complete', (event) => {
      if (loadedProjectId.value && event.payload?.projectId === loadedProjectId.value) {
        load(loadedProjectId.value).catch(() => {})
      }
    }).catch(() => {
      // Non-critical listener.
    })
  }

  return {
    recentDocuments,
    updatedDocuments,
    updatedSlugs,
    loading,
    loadedProjectId,
    load,
    refresh,
    markViewed,
  }
}
