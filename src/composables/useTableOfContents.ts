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

  function extractHeadings() {
    const container = document.querySelector(containerSelector)
    if (!container) return

    const elements = container.querySelectorAll('h2, h3')
    const items: TocHeading[] = []
    let fallbackIndex = 0

    elements.forEach((el) => {
      // Preserve build-time IDs from rehype-slug; only generate fallback if missing
      if (!el.id) {
        el.id = `heading-${fallbackIndex++}`
      }

      items.push({
        id: el.id,
        text: el.textContent?.trim() ?? '',
        level: el.tagName === 'H2' ? 2 : 3,
        isActive: false,
      })
    })

    headings.value = items
  }

  function observeHeadings() {
    if (observer) {
      observer.disconnect()
    }

    const container = document.querySelector(containerSelector)
    if (!container) return

    observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that is intersecting
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId.value = entry.target.id
            break
          }
        }
      },
      {
        rootMargin: '-52px 0px -70% 0px',
        threshold: 0,
      },
    )

    const elements = container.querySelectorAll('h2, h3')
    elements.forEach((el) => observer!.observe(el))
  }

  function scrollToHeading(id: string) {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      activeId.value = id
    }
  }

  async function refresh() {
    await nextTick()
    extractHeadings()
    observeHeadings()

    // Scroll to hash target if present in the URL
    const hash = window.location.hash?.slice(1)
    if (hash) {
      await nextTick()
      scrollToHeading(hash)
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    headings.value = []
    activeId.value = ''
  }

  onMounted(() => {
    refresh()
  })

  onUnmounted(() => {
    cleanup()
  })

  return { headings, activeId, scrollToHeading, refresh, cleanup }
}
