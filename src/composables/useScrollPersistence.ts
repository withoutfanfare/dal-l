import { saveScrollPosition, getScrollPosition } from '@/lib/api'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function useScrollPersistence() {
  function scheduleSave(projectId: string, docSlug: string, scrollTop: number) {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveScrollPosition(projectId, docSlug, scrollTop).catch(() => {
        // Non-critical; scroll position is a convenience feature.
      })
    }, 500)
  }

  async function restore(projectId: string, docSlug: string): Promise<number | null> {
    try {
      return await getScrollPosition(projectId, docSlug)
    } catch {
      return null
    }
  }

  function cancelPending() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  return { scheduleSave, restore, cancelPending }
}
