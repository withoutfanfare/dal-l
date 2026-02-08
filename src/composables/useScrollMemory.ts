import type { Router } from 'vue-router'

const scrollPositions = new Map<string, number>()

export function useScrollMemory(router: Router) {
  function getScrollContainer(): HTMLElement | null {
    return document.querySelector('main')
  }

  function savePosition(path: string) {
    const container = getScrollContainer()
    if (container) {
      // Evict oldest entry when map exceeds 100 entries
      if (scrollPositions.size > 100) {
        const firstKey = scrollPositions.keys().next().value
        if (firstKey) scrollPositions.delete(firstKey)
      }
      scrollPositions.set(path, container.scrollTop)
    }
  }

  function restorePosition(path: string) {
    const container = getScrollContainer()
    if (!container) return

    const saved = scrollPositions.get(path)
    if (saved !== undefined) {
      // Use requestAnimationFrame to ensure content has rendered
      requestAnimationFrame(() => {
        container.scrollTop = saved
      })
    } else {
      container.scrollTop = 0
    }
  }

  // Intentional: guards persist for app lifetime as AppLayout never unmounts
  router.beforeEach((_to, from) => {
    savePosition(from.fullPath)
  })

  router.afterEach((to) => {
    restorePosition(to.fullPath)
  })
}
