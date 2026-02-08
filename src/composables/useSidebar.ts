import { ref, reactive } from 'vue'

const SIDEBAR_WIDTH_KEY = 'dalil:sidebar-width'
const DEFAULT_WIDTH = 260
const MIN_WIDTH = 200
const MAX_WIDTH = 420

const collapsed = ref(false)
const sidebarWidth = ref(loadPersistedWidth())
const expandedSections = reactive(new Set<string>())

function loadPersistedWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (stored) {
      const w = parseInt(stored, 10)
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) return w
    }
  } catch { /* ignore */ }
  return DEFAULT_WIDTH
}

function persistWidth(w: number) {
  try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)) } catch { /* ignore */ }
}

export function useSidebar() {
  function toggleSidebar() {
    collapsed.value = !collapsed.value
  }

  function setSidebarWidth(w: number) {
    sidebarWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
  }

  function saveSidebarWidth() {
    persistWidth(sidebarWidth.value)
  }

  function toggleSection(slug: string) {
    if (expandedSections.has(slug)) {
      expandedSections.delete(slug)
    } else {
      expandedSections.add(slug)
    }
  }

  function isSectionExpanded(slug: string): boolean {
    return expandedSections.has(slug)
  }

  function expandSection(slug: string) {
    expandedSections.add(slug)
  }

  return {
    collapsed,
    sidebarWidth,
    MIN_WIDTH,
    MAX_WIDTH,
    toggleSidebar,
    setSidebarWidth,
    saveSidebarWidth,
    toggleSection,
    isSectionExpanded,
    expandSection,
  }
}
