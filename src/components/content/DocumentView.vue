<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { open } from '@tauri-apps/plugin-shell'
import type { Document } from '@/lib/types'
import { sanitiseHtml } from '@/lib/sanitise'

const props = defineProps<{
  document: Document
}>()

// Cache sanitised HTML keyed by slug + content length to avoid serving stale content after rebuilds
const htmlCache = new Map<string, string>()
const renderedHtml = ref('')

watch(
  () => props.document.slug,
  async () => {
    // Update rendered HTML (with cache)
    const cacheKey = `${props.document.slug}_${props.document.content_html.length}`
    let html = htmlCache.get(cacheKey)
    if (!html) {
      html = sanitiseHtml(props.document.content_html)
      htmlCache.set(cacheKey, html)
      // Keep cache bounded
      if (htmlCache.size > 30) {
        const first = htmlCache.keys().next().value!
        htmlCache.delete(first)
      }
    }
    renderedHtml.value = html

    // Inject heading anchors + enter animation after DOM update
    await nextTick()
    injectHeadingAnchors()
    if (contentRef.value) {
      contentRef.value.setAttribute('data-enter', '')
      contentRef.value.addEventListener('animationend', () => {
        contentRef.value?.removeAttribute('data-enter')
      }, { once: true })
    }
  },
  { immediate: true },
)

const router = useRouter()
const route = useRoute()
const contentRef = ref<HTMLElement | null>(null)

const anchorSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // Handle heading anchor link clicks
  const headingAnchor = target.closest('.heading-anchor') as HTMLElement | null
  if (headingAnchor) {
    event.preventDefault()
    event.stopPropagation()
    const heading = headingAnchor.closest('h2, h3')
    if (heading?.id) {
      const deeplink = `dalil://${router.currentRoute.value.path.replace(/^\//, '')}#${heading.id}`
      try {
        navigator.clipboard.writeText(deeplink).then(() => {
          headingAnchor.classList.add('heading-anchor-copied')
          setTimeout(() => headingAnchor.classList.remove('heading-anchor-copied'), 1500)
        }).catch(() => { /* clipboard not available */ })
      } catch {
        /* clipboard API not supported */
      }
    }
    return
  }

  const anchor = target.closest('a')
  if (!anchor) return

  const href = anchor.getAttribute('href')
  if (!href) return

  event.preventDefault()

  if (href.startsWith('#')) {
    const id = href.slice(1)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } else if (href.startsWith('/docs/')) {
    router.push(href.slice(5)).catch(() => {})
  } else if (href.startsWith('/')) {
    router.push(href).catch(() => {})
  } else if (/^https?:\/\//.test(href)) {
    open(href)
  } else {
    // Handle relative links — resolve against the current document's path
    const currentPath = route.params.slug
      ? `/${route.params.collection}/${route.params.slug}`
      : `/${route.params.collection}`
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'))
    const resolved = `${basePath}/${href}`.replace(/\.md$/, '')
    router.push(resolved).catch(() => {})
  }
}

function injectHeadingAnchors() {
  if (!contentRef.value) return

  const headings = contentRef.value.querySelectorAll('h2[id], h3[id]')
  headings.forEach((heading) => {
    if (heading.querySelector('.heading-anchor')) return
    const btn = document.createElement('span')
    btn.className = 'heading-anchor'
    btn.setAttribute('role', 'button')
    btn.setAttribute('tabindex', '0')
    btn.setAttribute('aria-label', 'Copy link to section')
    btn.innerHTML = anchorSvg
    heading.appendChild(btn)
  })
}

onMounted(async () => {
  contentRef.value?.addEventListener('click', handleClick)
  await nextTick()
  injectHeadingAnchors()
  if (contentRef.value) {
    contentRef.value.setAttribute('data-enter', '')
    contentRef.value.addEventListener('animationend', () => {
      contentRef.value?.removeAttribute('data-enter')
    }, { once: true })
  }
})

onBeforeUnmount(() => {
  contentRef.value?.removeEventListener('click', handleClick)
})
</script>

<template>
  <div
    ref="contentRef"
    class="prose prose-neutral max-w-none
           prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-text-primary
           prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-border
           prose-h3:text-base prose-h3:mt-7 prose-h3:mb-2
           prose-h4:text-sm prose-h4:mt-5 prose-h4:mb-1.5 prose-h4:uppercase prose-h4:tracking-wide prose-h4:text-text-secondary
           prose-p:text-[15px] prose-p:leading-relaxed prose-p:text-text-primary
           prose-li:text-[15px] prose-li:text-text-primary
           prose-a:text-accent prose-a:no-underline hover:prose-a:underline
           prose-strong:text-text-primary prose-strong:font-semibold
           prose-blockquote:border-accent/30 prose-blockquote:text-text-secondary prose-blockquote:not-italic
           prose-hr:border-border
           prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:tracking-wider prose-th:text-text-secondary prose-th:font-medium
           prose-td:text-sm prose-td:text-text-primary"
    v-html="renderedHtml"
  />
</template>
