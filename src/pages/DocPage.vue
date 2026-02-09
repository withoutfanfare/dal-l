<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getDocument } from '@/lib/api'
import type { Document } from '@/lib/types'
import { useCollections } from '@/composables/useCollections'
import { useSequentialNavigation } from '@/composables/useSequentialNavigation'
import ContentHeader from '@/components/content/ContentHeader.vue'
import DocumentView from '@/components/content/DocumentView.vue'
import Breadcrumbs from '@/components/content/Breadcrumbs.vue'
import TableOfContents from '@/components/content/TableOfContents.vue'

const route = useRoute()
const { setActiveCollection } = useCollections()
const { previousDoc, nextDoc } = useSequentialNavigation()

const document = ref<Document | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showBackToTop = ref(false)
const readingProgress = ref(0)
let scrollContainer: HTMLElement | null = null
let scrollRaf: number | null = null

function onScroll() {
  if (scrollRaf !== null) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = null
    if (!scrollContainer) return
    showBackToTop.value = scrollContainer.scrollTop > 300
    const scrollable = scrollContainer.scrollHeight - scrollContainer.clientHeight
    readingProgress.value = scrollable > 0
      ? Math.min(100, (scrollContainer.scrollTop / scrollable) * 100)
      : 0
  })
}

function scrollToTop() {
  scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  // The main scroll container is the <main> element in AppLayout
  scrollContainer = window.document.querySelector('main.overflow-y-auto') as HTMLElement
  scrollContainer?.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  scrollContainer?.removeEventListener('scroll', onScroll)
  if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
})

async function fetchDocument() {
  const slug = Array.isArray(route.params.slug)
    ? route.params.slug.join('/')
    : route.params.slug

  const collection = route.params.collection as string

  if (!slug || !collection) return

  loading.value = true
  error.value = null

  try {
    // Construct the full slug: collection/slug
    const fullSlug = `${collection}/${slug}`
    document.value = await getDocument(fullSlug)
    setActiveCollection(document.value.collection_id)

    // Update window title
    window.document.title = `${document.value.title} \u2014 dal\u012Bl`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    document.value = null
  } finally {
    loading.value = false
  }
}

function handleRetry() {
  fetchDocument()
}

watch(
  () => [route.params.collection, route.params.slug],
  () => fetchDocument(),
  { immediate: true },
)
</script>

<template>
  <!-- Reading progress bar -->
  <div
    v-if="document && !loading"
    class="fixed top-[52px] left-0 right-0 z-40 h-[2px] pointer-events-none"
  >
    <div
      class="h-full bg-accent transition-[width] duration-75 ease-out"
      :style="{ width: `${readingProgress}%` }"
    />
  </div>

  <div class="flex gap-8">
    <div class="min-w-0 flex-1">
      <!-- Loading skeleton -->
      <div v-if="loading" class="animate-pulse">
        <div class="h-4 w-1/4 rounded bg-stone-200 dark:bg-stone-700 mb-6" />
        <div class="h-8 w-1/3 rounded bg-stone-200 dark:bg-stone-700 mb-8" />
        <div class="space-y-4">
          <div class="h-4 w-full rounded bg-stone-200 dark:bg-stone-700" />
          <div class="h-4 w-5/6 rounded bg-stone-200 dark:bg-stone-700" />
          <div class="h-4 w-4/6 rounded bg-stone-200 dark:bg-stone-700" />
        </div>
        <div class="mt-8 space-y-4">
          <div class="h-4 w-full rounded bg-stone-200 dark:bg-stone-700" />
          <div class="h-4 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
          <div class="h-4 w-5/6 rounded bg-stone-200 dark:bg-stone-700" />
          <div class="h-4 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="py-16 text-center">
        <svg class="w-10 h-10 text-text-secondary/40 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p class="text-sm text-text-secondary mb-4">{{ error }}</p>
        <div class="flex items-center justify-center gap-3">
          <button
            class="rounded-lg bg-accent px-4 py-2 text-sm text-white font-medium transition-opacity hover:opacity-90"
            @click="handleRetry"
          >
            Try again
          </button>
          <router-link
            to="/"
            class="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
          >
            Go home
          </router-link>
        </div>
      </div>

      <!-- Document -->
      <template v-else-if="document">
        <Breadcrumbs :document="document" class="mb-6" />
        <ContentHeader :document="document" />
        <DocumentView :document="document" />

        <!-- Next/Previous navigation -->
        <nav
          v-if="previousDoc || nextDoc"
          class="mt-12 flex items-stretch border-t border-border pt-6"
        >
          <router-link
            v-if="previousDoc"
            :to="`/${previousDoc.collectionId}/${previousDoc.slug}`"
            class="group flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors"
          >
            <svg class="w-4 h-4 flex-shrink-0 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span class="truncate">{{ previousDoc.title }}</span>
          </router-link>

          <div class="flex-1" />

          <router-link
            v-if="nextDoc"
            :to="`/${nextDoc.collectionId}/${nextDoc.slug}`"
            class="group flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors text-right"
          >
            <span class="truncate">{{ nextDoc.title }}</span>
            <svg class="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </router-link>
        </nav>
      </template>
    </div>

    <!-- Table of Contents (wide viewports only) -->
    <TableOfContents
      v-if="document && !loading"
      :content-key="document.slug"
    />
  </div>

  <!-- Back to top -->
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-90"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-90"
  >
    <button
      v-if="showBackToTop"
      class="fixed bottom-6 right-6 z-[100] flex items-center justify-center w-9 h-9 rounded-full bg-surface shadow-lg ring-1 ring-border text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
      title="Back to top"
      @click="scrollToTop"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      </svg>
    </button>
  </Transition>
</template>
