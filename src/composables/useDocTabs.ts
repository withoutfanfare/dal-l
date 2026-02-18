import { ref, watch, type WatchStopHandle } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

export interface DocTab {
  slug: string
  title: string
  lastOpenedAt: number
  pinned?: boolean
}

interface TabBucket {
  tabs: DocTab[]
  activeSlug: string | null
}

type TabState = Record<string, TabBucket>

const STORAGE_KEY = 'dalil:doc-tabs:v1'
const state = ref<TabState>({})
let hydrated = false
let stopHandle: WatchStopHandle | null = null

function storageKey(projectId: string, collectionId: string): string {
  return `${projectId}::${collectionId}`
}

function defaultTitle(slug: string): string {
  const tail = slug.split('/').filter(Boolean).pop() ?? slug
  return tail
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

function upsertTab(projectId: string, collectionId: string, slug: string, title: string) {
  const bucket = ensureBucket(projectId, collectionId)
  const idx = bucket.tabs.findIndex((tab) => tab.slug === slug)
  const now = Date.now()

  if (idx >= 0) {
    bucket.tabs[idx] = {
      ...bucket.tabs[idx],
      title: title || bucket.tabs[idx].title,
      lastOpenedAt: now,
    }
  } else {
    bucket.tabs.push({
      slug,
      title: title || defaultTitle(slug),
      lastOpenedAt: now,
    })
  }

  bucket.activeSlug = slug
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
        upsertTab(projectId, docRoute.collectionId, docRoute.slug, defaultTitle(docRoute.slug))
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
      upsertTab(projectId, collectionId, slug, title)
      return
    }
    tab.title = title || tab.title
    persist()
  }

  function togglePinTab(projectId: string, collectionId: string, slug: string): boolean | null {
    const bucket = ensureBucket(projectId, collectionId)
    const idx = bucket.tabs.findIndex((item) => item.slug === slug)
    if (idx < 0) return null

    const current = bucket.tabs[idx]
    const nextPinned = !current.pinned
    const updated = {
      ...current,
      pinned: nextPinned,
      lastOpenedAt: Date.now(),
    }

    bucket.tabs[idx] = updated
    const [moved] = bucket.tabs.splice(idx, 1)

    if (nextPinned) {
      const firstUnpinnedIndex = bucket.tabs.findIndex((item) => !item.pinned)
      const targetIndex = firstUnpinnedIndex === -1 ? bucket.tabs.length : firstUnpinnedIndex
      bucket.tabs.splice(targetIndex, 0, moved)
    } else {
      let lastPinnedIndex = -1
      for (let i = bucket.tabs.length - 1; i >= 0; i -= 1) {
        if (bucket.tabs[i].pinned) {
          lastPinnedIndex = i
          break
        }
      }
      bucket.tabs.splice(lastPinnedIndex + 1, 0, moved)
    }

    persist()
    return nextPinned
  }

  function moveTab(projectId: string, collectionId: string, slug: string, targetIndex: number) {
    const bucket = ensureBucket(projectId, collectionId)
    const fromIndex = bucket.tabs.findIndex((item) => item.slug === slug)
    if (fromIndex < 0) return

    const boundedIndex = Math.max(0, Math.min(targetIndex, bucket.tabs.length - 1))
    if (fromIndex === boundedIndex) return

    const [moved] = bucket.tabs.splice(fromIndex, 1)
    bucket.tabs.splice(boundedIndex, 0, moved)
    persist()
  }

  function getAdjacentSlug(
    projectId: string,
    collectionId: string,
    slug: string,
    direction: -1 | 1,
  ): string | null {
    const bucket = ensureBucket(projectId, collectionId)
    if (bucket.tabs.length === 0) return null
    const currentIndex = bucket.tabs.findIndex((item) => item.slug === slug)
    if (currentIndex < 0) return bucket.tabs[0]?.slug ?? null

    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= bucket.tabs.length) return null
    return bucket.tabs[nextIndex]?.slug ?? null
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
    const kept = bucket.tabs.filter((tab) => tab.pinned)
    if (kept.length === bucket.tabs.length) {
      return bucket.activeSlug
    }

    const activeTab = bucket.tabs.find((tab) => tab.slug === bucket.activeSlug) ?? null
    bucket.tabs = kept
    if (!activeTab?.pinned) {
      bucket.activeSlug = kept[kept.length - 1]?.slug ?? null
    }

    persist()
    return bucket.activeSlug
  }

  return {
    state,
    registerRouter,
    getTabs,
    getActiveSlug,
    closeTab,
    setActiveTab,
    setTabTitle,
    togglePinTab,
    moveTab,
    getAdjacentSlug,
    clearCollectionTabs,
    closeUnpinnedTabs,
  }
}
