import { watch } from 'vue'
import type { Router } from 'vue-router'

const STORAGE_KEY = 'dalil:last-path'

export function useLastVisited(router: Router) {
  // Persist the current path on every navigation
  watch(
    () => router.currentRoute.value.fullPath,
    (path) => {
      if (path && path !== '/') {
        try { localStorage.setItem(STORAGE_KEY, path) } catch { /* ignore */ }
      }
    },
  )

  // Restore the last visited path on initial load (only when landing on home)
  function restoreIfHome() {
    if (router.currentRoute.value.path === '/') {
      try {
        const last = localStorage.getItem(STORAGE_KEY)
        if (last && last !== '/') {
          router.replace(last)
        }
      } catch { /* ignore */ }
    }
  }

  return { restoreIfHome }
}
