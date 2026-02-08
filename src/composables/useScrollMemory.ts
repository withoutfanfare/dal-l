import type { Router } from 'vue-router'

const scrollPositions = new Map<string, number>()

export function useScrollMemory(router: Router) {
  function getScrollContainer(): HTMLElement | null {
    return document.querySelector('main')
  }

  function savePosition(path: string) {
    const container = getScrollContainer()
    if (container) {
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

  router.beforeEach((_to, from) => {
    savePosition(from.fullPath)
  })

  router.afterEach((to) => {
    restorePosition(to.fullPath)
  })
}
