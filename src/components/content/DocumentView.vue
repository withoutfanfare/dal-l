<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { open } from '@tauri-apps/plugin-shell'
import type { Document } from '@/lib/types'
import { sanitiseHtml } from '@/lib/sanitise'

const props = defineProps<{
  document: Document
}>()

const safeHtml = computed(() => sanitiseHtml(props.document.content_html))

watch(() => props.document.slug, async () => {
  await nextTick()
  injectHeadingAnchors()
})

const router = useRouter()
const contentRef = ref<HTMLElement | null>(null)

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // Handle heading anchor link clicks
  const headingAnchor = target.closest('.heading-anchor')
  if (headingAnchor) {
    event.preventDefault()
    const heading = headingAnchor.closest('h2, h3')
    if (heading?.id) {
      const url = `${window.location.origin}${window.location.pathname}#${heading.id}`
      navigator.clipboard.writeText(url)
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
    const path = href.slice(5)
    router.push(path)
  } else if (href.startsWith('/')) {
    router.push(href)
  } else if (/^https?:\/\//.test(href)) {
    open(href)
  }
}

function injectHeadingAnchors() {
  if (!contentRef.value) return

  const headings = contentRef.value.querySelectorAll('h2[id], h3[id]')
  headings.forEach((heading) => {
    if (heading.querySelector('.heading-anchor')) return
    const anchor = document.createElement('a')
    anchor.className = 'heading-anchor'
    anchor.setAttribute('aria-label', 'Copy link to section')
    anchor.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
    heading.appendChild(anchor)
  })
}

onMounted(async () => {
  contentRef.value?.addEventListener('click', handleClick)
  await nextTick()
  injectHeadingAnchors()
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
    v-html="safeHtml"
  />
</template>
