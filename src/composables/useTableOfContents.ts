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

  function getObserver(): IntersectionObserver {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              activeId.value = entry.target.id
              break
            }
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

    // Scroll to hash target if present in the URL
    const hash = window.location.hash?.slice(1)
    if (hash) {
      nextTick(() => scrollToHeading(hash))
    }
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      activeId.value = id
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    observedElements.clear()
    headings.value = []
    activeId.value = ''
  }

  onMounted(async () => {
    await nextTick()
    refresh()
  })

  onUnmounted(() => {
    cleanup()
  })

  return { headings, activeId, scrollToHeading, refresh, cleanup }
}
