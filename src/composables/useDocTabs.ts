import { ref, watch, type WatchStopHandle } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import {
  defaultTitleFromSlug,
  upsertTabInBucket,
  syncRouteToTabBucket,
  moveTabInBucket,
  getAdjacentSlugInBucket,
  togglePinInBucket,
  closeUnpinnedTabsInBucket,
  type DocTab,
  type TabBucket,
} from '@/lib/tabState'

type TabState = Record<string, TabBucket>

const STORAGE_KEY = 'dalil:doc-tabs:v1'
const state = ref<TabState>({})
const pendingNewTabKeys = new Set<string>()
let hydrated = false
let stopHandle: WatchStopHandle | null = null

function storageKey(projectId: string, collectionId: string): string {
  return `${projectId}::${collectionId}`
}

function hydrate() {
  if (hydrated) return
  hydrated = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as TabState
    if (!parsed || typeof parsed !== 'object') return
    state.value = parsed
  } catch {
    state.value = {}
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
  } catch {
    // Non-critical when storage is unavailable.
  }
}

function ensureBucket(projectId: string, collectionId: string): TabBucket {
  hydrate()
  const key = storageKey(projectId, collectionId)
  if (!state.value[key]) {
    state.value[key] = { tabs: [], activeSlug: null }
  }
  return state.value[key]
}

function parseDocRoute(route: RouteLocationNormalizedLoaded): { collectionId: string, slug: string } | null {
  if (route.name !== 'doc') return null

  const collectionParam = route.params.collection
  const slugParam = route.params.slug

  const collectionId = Array.isArray(collectionParam) ? collectionParam[0] : collectionParam
  const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam

  if (!collectionId || !slug || !slug.trim()) return null

  return {
    collectionId,
    slug,
  }
}

function syncRouteToTabs(projectId: string, collectionId: string, slug: string, title: string) {
  const key = storageKey(projectId, collectionId)
  const createNewTab = pendingNewTabKeys.has(key)
  pendingNewTabKeys.delete(key)

  const bucket = ensureBucket(projectId, collectionId)
  syncRouteToTabBucket(bucket, slug, title, createNewTab)
  persist()
}

export function useDocTabs() {
  function registerRouter(router: Router, getProjectId: () => string) {
    hydrate()

    if (stopHandle) return

    stopHandle = watch(
      () => router.currentRoute.value.fullPath,
      () => {
        const docRoute = parseDocRoute(router.currentRoute.value)
        if (!docRoute) return

        const projectId = getProjectId() || 'default'
        syncRouteToTabs(projectId, docRoute.collectionId, docRoute.slug, defaultTitleFromSlug(docRoute.slug))
      },
      { immediate: true },
    )
  }

  function getTabs(projectId: string, collectionId: string): DocTab[] {
    const bucket = ensureBucket(projectId, collectionId)
    return bucket.tabs
  }

  function getActiveSlug(projectId: string, collectionId: string): string | null {
    const bucket = ensureBucket(projectId, collectionId)
    return bucket.activeSlug
  }

  function closeTab(projectId: string, collectionId: string, slug: string): string | null {
    const bucket = ensureBucket(projectId, collectionId)
    const idx = bucket.tabs.findIndex((tab) => tab.slug === slug)
    if (idx < 0) return bucket.activeSlug

    bucket.tabs.splice(idx, 1)

    if (bucket.activeSlug === slug) {
      const next = bucket.tabs[idx] ?? bucket.tabs[idx - 1] ?? null
      bucket.activeSlug = next?.slug ?? null
    }

    persist()
    return bucket.activeSlug
  }

  function setActiveTab(projectId: string, collectionId: string, slug: string) {
    const bucket = ensureBucket(projectId, collectionId)
    const tab = bucket.tabs.find((item) => item.slug === slug)
    if (tab) tab.lastOpenedAt = Date.now()
    bucket.activeSlug = slug
    persist()
  }

  function setTabTitle(projectId: string, collectionId: string, slug: string, title: string) {
    const bucket = ensureBucket(projectId, collectionId)
    const tab = bucket.tabs.find((item) => item.slug === slug)
    if (!tab) {
      upsertTabInBucket(bucket, slug, title)
      persist()
      return
    }
    tab.title = title || tab.title
    persist()
  }

  function beginNewTab(projectId: string, collectionId: string) {
    pendingNewTabKeys.add(storageKey(projectId, collectionId))
  }

function isNewTabPending(projectId: string, collectionId: string): boolean {
  return pendingNewTabKeys.has(storageKey(projectId, collectionId))
}

function cancelNewTab(projectId: string, collectionId: string) {
  pendingNewTabKeys.delete(storageKey(projectId, collectionId))
}

  function togglePinTab(projectId: string, collectionId: string, slug: string): boolean | null {
    const bucket = ensureBucket(projectId, collectionId)
    const nextPinned = togglePinInBucket(bucket, slug)
    persist()
    return nextPinned
  }

  function moveTab(projectId: string, collectionId: string, slug: string, targetIndex: number) {
    const bucket = ensureBucket(projectId, collectionId)
    moveTabInBucket(bucket, slug, targetIndex)
    persist()
  }

  function getAdjacentSlug(
    projectId: string,
    collectionId: string,
    slug: string,
    direction: -1 | 1,
  ): string | null {
    const bucket = ensureBucket(projectId, collectionId)
    return getAdjacentSlugInBucket(bucket, slug, direction)
  }

  function clearCollectionTabs(projectId: string, collectionId: string) {
    const key = storageKey(projectId, collectionId)
    if (state.value[key]) {
      delete state.value[key]
      persist()
    }
  }

  function closeUnpinnedTabs(projectId: string, collectionId: string): string | null {
    const bucket = ensureBucket(projectId, collectionId)
    const next = closeUnpinnedTabsInBucket(bucket)
    persist()
    return next
  }

  return {
    state,
    registerRouter,
    getTabs,
    getActiveSlug,
    closeTab,
    setActiveTab,
    setTabTitle,
    beginNewTab,
    isNewTabPending,
    cancelNewTab,
    togglePinTab,
    moveTab,
    getAdjacentSlug,
    clearCollectionTabs,
    closeUnpinnedTabs,
  }
}

export function __unsafeResetDocTabsForTests(options?: { clearStorage?: boolean }) {
  stopHandle?.()
  stopHandle = null
  hydrated = false
  state.value = {}
  pendingNewTabKeys.clear()
  if (options?.clearStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors in tests.
    }
  }
}
