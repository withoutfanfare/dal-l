import { computed, ref, watch, type WatchStopHandle } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'

const entries = ref<string[]>([])
const index = ref(-1)
let stopHandle: WatchStopHandle | null = null
let suppressRecord = false

function isTrackable(route: RouteLocationNormalizedLoaded): boolean {
  return route.name === 'doc'
}

function record(path: string) {
  if (suppressRecord) {
    suppressRecord = false
    return
  }

  if (index.value >= 0 && entries.value[index.value] === path) {
    return
  }

  if (index.value < entries.value.length - 1) {
    entries.value = entries.value.slice(0, index.value + 1)
  }

  entries.value = [...entries.value, path]

  if (entries.value.length > 200) {
    entries.value = entries.value.slice(entries.value.length - 200)
  }

  index.value = entries.value.length - 1
}

export function useDocHistory() {
  const canGoBack = computed(() => index.value > 0)
  const canGoForward = computed(() => index.value >= 0 && index.value < entries.value.length - 1)

  function registerRouter(router: Router) {
    if (stopHandle) return

    stopHandle = watch(
      () => router.currentRoute.value.fullPath,
      () => {
        const route = router.currentRoute.value
        if (!isTrackable(route)) return
        record(route.fullPath)
      },
      { immediate: true },
    )
  }

  function goBack(router: Router) {
    if (!canGoBack.value) return
    index.value -= 1
    suppressRecord = true
    router.push(entries.value[index.value]).catch(() => {
      suppressRecord = false
    })
  }

  function goForward(router: Router) {
    if (!canGoForward.value) return
    index.value += 1
    suppressRecord = true
    router.push(entries.value[index.value]).catch(() => {
      suppressRecord = false
    })
  }

  return {
    entries,
    index,
    canGoBack,
    canGoForward,
    registerRouter,
    goBack,
    goForward,
  }
}
