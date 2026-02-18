import { ref, onMounted, onUnmounted, nextTick } from 'vue'

export interface TocHeading {
  id: string
  text: string
  level: number
  isActive: boolean
}

export function useTableOfContents(containerSelector: string = '.prose') {
  const headings = ref<TocHeading[]>([])
  const activeId = ref<string>('')

  let observer: IntersectionObserver | null = null
  const observedElements = new Set<Element>()
  let scrollRoot: HTMLElement | null = null
  let scrollRaf: number | null = null
  let manualActiveUntil = 0
  let manualActiveId = ''

  const TOP_OFFSET_PX = 110
  const CLICK_LOCK_MS = 700

  function getScrollRoot(): HTMLElement | null {
    if (scrollRoot && document.body.contains(scrollRoot)) return scrollRoot
    scrollRoot = document.querySelector('main.overflow-y-auto') as HTMLElement | null
    return scrollRoot
  }

  function computeActiveHeading() {
    if (headings.value.length === 0) return

    if (manualActiveId && Date.now() < manualActiveUntil) {
      activeId.value = manualActiveId
      return
    }

    const ordered = headings.value
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => !!element)

    if (ordered.length === 0) return

    let candidate: HTMLElement | null = null
    for (const heading of ordered) {
      const top = heading.getBoundingClientRect().top
      if (top <= TOP_OFFSET_PX) {
        candidate = heading
      } else {
        break
      }
    }

    if (!candidate) {
      candidate = ordered[0]
    }

    activeId.value = candidate.id
    manualActiveId = ''
  }

  function onScrollOrResize() {
    if (scrollRaf !== null) return
    scrollRaf = window.requestAnimationFrame(() => {
      scrollRaf = null
      computeActiveHeading()
    })
  }

  function getObserver(): IntersectionObserver {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            computeActiveHeading()
          }
        },
        { rootMargin: '-52px 0px -70% 0px', threshold: 0 },
      )
    }
    return observer
  }

  function refresh() {
    const container = document.querySelector(containerSelector)
    if (!container) return

    // Unobserve previous elements without destroying the observer
    const obs = getObserver()
    for (const el of observedElements) {
      obs.unobserve(el)
    }
    observedElements.clear()

    // Extract headings
    const elements = container.querySelectorAll('h2, h3')
    const items: TocHeading[] = []
    let fallbackIndex = 0

    elements.forEach((el) => {
      if (!el.id) {
        el.id = `heading-${fallbackIndex++}`
      }
      items.push({
        id: el.id,
        text: el.textContent?.trim() ?? '',
        level: el.tagName === 'H2' ? 2 : 3,
        isActive: false,
      })
      obs.observe(el)
      observedElements.add(el)
    })

    headings.value = items
    computeActiveHeading()

    // Scroll to hash target if present in the URL
    const hash = window.location.hash?.slice(1)
    if (hash) {
      nextTick(() => scrollToHeading(hash))
    }
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id)
    if (element) {
      const root = getScrollRoot()
      if (root) {
        const rootRect = root.getBoundingClientRect()
        const targetRect = element.getBoundingClientRect()
        const targetTop = root.scrollTop + (targetRect.top - rootRect.top) - TOP_OFFSET_PX
        root.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
      } else {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      manualActiveId = id
      manualActiveUntil = Date.now() + CLICK_LOCK_MS
      activeId.value = id
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    observedElements.clear()
    if (scrollRaf !== null) {
      cancelAnimationFrame(scrollRaf)
      scrollRaf = null
    }
    scrollRoot?.removeEventListener('scroll', onScrollOrResize)
    window.removeEventListener('resize', onScrollOrResize)
    scrollRoot = null
    manualActiveId = ''
    manualActiveUntil = 0
    headings.value = []
    activeId.value = ''
  }

  onMounted(async () => {
    await nextTick()
    getScrollRoot()?.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)
    refresh()
  })

  onUnmounted(() => {
    cleanup()
  })

  return { headings, activeId, scrollToHeading, refresh, cleanup }
}
