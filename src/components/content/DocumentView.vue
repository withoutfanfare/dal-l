<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { open } from '@tauri-apps/plugin-shell'
import type { Document } from '@/lib/types'
import { sanitiseHtml } from '@/lib/sanitise'
import { useToast } from '@/composables/useToast'
import { useProjects } from '@/composables/useProjects'
import { buildDeepLink, docSlugWithoutCollection } from '@/lib/deepLinks'
import ImageLightbox from './ImageLightbox.vue'

const props = defineProps<{
  document: Document
  compareMode?: boolean
  changedHeadingIds?: string[]
}>()

const { addToast } = useToast()
const { activeProjectId } = useProjects()

// Lightbox state
const lightboxSrc = ref('')
const lightboxAlt = ref('')
const lightboxOpen = ref(false)

function openLightbox(src: string, alt: string) {
  lightboxSrc.value = src
  lightboxAlt.value = alt
  lightboxOpen.value = true
}

function closeLightbox() {
  lightboxOpen.value = false
}

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

    // Inject heading anchors, copy buttons + enter animation after DOM update
    await nextTick()
    injectHeadingAnchors()
    injectCopyButtons()
    applyCompareHighlights()
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

const copySvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'

function injectCopyButtons() {
  if (!contentRef.value) return

  const preBlocks = contentRef.value.querySelectorAll('pre')
  preBlocks.forEach((pre) => {
    if (pre.querySelector('.code-copy-btn')) return
    const btn = document.createElement('button')
    btn.setAttribute('type', 'button')
    btn.className = 'code-copy-btn'
    btn.setAttribute('aria-label', 'Copy code')
    btn.setAttribute('title', 'Copy code')
    btn.innerHTML = copySvg
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const text = pre.textContent || ''
      navigator.clipboard.writeText(text).then(() => {
        addToast('Copied to clipboard', 'success')
      }).catch(() => { /* clipboard not available */ })
    })
    pre.appendChild(btn)
  })
}

async function copySectionLink(anchorId: string) {
  if (!activeProjectId.value) return
  const deeplink = buildDeepLink({
    projectId: activeProjectId.value,
    collectionId: props.document.collection_id,
    docSlug: docSlugWithoutCollection(props.document.collection_id, props.document.slug),
    anchorId,
  })
  try {
    await navigator.clipboard.writeText(deeplink)
    addToast('Section link copied', 'success')
  } catch {
    addToast('Could not copy section link', 'error')
  }
}

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // Handle image clicks for lightbox
  if (target.tagName === 'IMG') {
    const img = target as HTMLImageElement
    if (img.naturalWidth > 100) {
      event.preventDefault()
      event.stopPropagation()
      openLightbox(img.src, img.alt || '')
      return
    }
  }

  // Handle heading anchor link clicks
  const headingAnchor = target.closest('.heading-anchor') as HTMLElement | null
  if (headingAnchor) {
    event.preventDefault()
    event.stopPropagation()
    const anchorId = headingAnchor.getAttribute('data-anchor-id')
    if (anchorId) {
      copySectionLink(anchorId).catch(() => {})
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
    const btn = document.createElement('button')
    btn.setAttribute('type', 'button')
    btn.className = 'heading-anchor'
    btn.setAttribute('data-anchor-id', heading.id)
    btn.setAttribute('aria-label', 'Copy link to section')
    btn.setAttribute('title', 'Copy section link')
    btn.innerHTML = anchorSvg
    heading.appendChild(btn)
  })
}

function applyCompareHighlights() {
  if (!contentRef.value) return
  const headings = contentRef.value.querySelectorAll('h2[id], h3[id]')
  const changedIds = new Set(props.changedHeadingIds ?? [])
  headings.forEach((heading) => {
    heading.classList.remove('heading-compare-changed')
    if (props.compareMode && changedIds.has((heading as HTMLElement).id)) {
      heading.classList.add('heading-compare-changed')
    }
  })
}

watch(
  () => [props.compareMode, props.changedHeadingIds?.join('|')],
  async () => {
    await nextTick()
    applyCompareHighlights()
  },
)

onMounted(async () => {
  contentRef.value?.addEventListener('click', handleClick)
  await nextTick()
  injectHeadingAnchors()
  injectCopyButtons()
  applyCompareHighlights()
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
    class="prose prose-neutral max-w-none prose-img-lightbox
           prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-text-primary
           prose-h1:text-[1.95rem] prose-h1:leading-tight prose-h1:mt-8 prose-h1:mb-4 sm:prose-h1:text-[2.15rem]
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

  <ImageLightbox
    v-if="lightboxOpen"
    :src="lightboxSrc"
    :alt="lightboxAlt"
    @close="closeLightbox"
  />
</template>
