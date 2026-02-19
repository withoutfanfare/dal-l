<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getDocument } from '@/lib/api'
import type { Document } from '@/lib/types'
import { useCollections } from '@/composables/useCollections'
import { useSequentialNavigation } from '@/composables/useSequentialNavigation'
import { useProjects } from '@/composables/useProjects'
import { useBookmarks } from '@/composables/useBookmarks'
import { useDocActivity } from '@/composables/useDocActivity'
import { useDocNotes } from '@/composables/useDocNotes'
import { useDocTabs } from '@/composables/useDocTabs'
import { useToast } from '@/composables/useToast'
import ContentHeader from '@/components/content/ContentHeader.vue'
import DocumentView from '@/components/content/DocumentView.vue'
import Breadcrumbs from '@/components/content/Breadcrumbs.vue'
import DocRightSidebar from '@/components/content/DocRightSidebar.vue'
import { buildDeepLink, docSlugWithoutCollection } from '@/lib/deepLinks'

const route = useRoute()
const router = useRouter()
const { setActiveCollection } = useCollections()
const { previousDoc, nextDoc } = useSequentialNavigation()
const { activeProjectId } = useProjects()
const { ensureLoaded, toggleBookmark, isBookmarked, byDocSlug, removeBookmark } = useBookmarks()
const { markViewed } = useDocActivity()
const { note, highlights, load: loadDocNotes, save: saveDocNote, addHighlight, removeHighlight } = useDocNotes()
const { setTabTitle } = useDocTabs()
const { addToast } = useToast()

const document = ref<Document | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const showBackToTop = ref(false)
const readingProgress = ref(0)
const compareModeEnabled = ref(false)
const changedHeadingIds = ref<string[]>([])
const changedSectionTitles = ref<string[]>([])
const removedSectionTitles = ref<string[]>([])
const noteDraft = ref('')
const savingNote = ref(false)
const lastSavedNote = ref('')
const focusNoteToken = ref(0)
let scrollContainer: HTMLElement | null = null
let scrollRaf: number | null = null
let noteSaveTimer: ReturnType<typeof setTimeout> | null = null
let fetchRequestId = 0

const bookmarked = computed(() => {
  if (!document.value || !activeProjectId.value) return false
  return isBookmarked(activeProjectId.value, document.value.slug, null)
})

const docBookmarks = computed(() => {
  if (!document.value) return []
  return byDocSlug.value.get(document.value.slug) ?? []
})

const changedSectionsLabel = computed(() => {
  const count = changedHeadingIds.value.length
  return `${count} section${count === 1 ? '' : 's'} changed since last visit`
})

function compareSnapshotKey(projectId: string, docSlug: string): string {
  return `dalil:compare:${projectId}:${docSlug}`
}

interface SectionSnapshot {
  title: string
  text: string
}

function extractSectionSnapshot(contentHtml: string): Record<string, SectionSnapshot> {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(contentHtml, 'text/html')
  const root = parsed.body
  const headings = Array.from(root.querySelectorAll('h2[id], h3[id]')) as HTMLElement[]
  const snapshot: Record<string, SectionSnapshot> = {}

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i]
    const nextHeading = headings[i + 1] ?? null
    const textParts: string[] = []
    let cursor: ChildNode | null = heading.nextSibling
    while (cursor && cursor !== nextHeading) {
      textParts.push((cursor.textContent ?? '').trim())
      cursor = cursor.nextSibling
    }
    snapshot[heading.id] = {
      title: (heading.textContent ?? heading.id).trim(),
      text: textParts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase(),
    }
  }

  return snapshot
}

function loadPreviousSnapshot(projectId: string, docSlug: string): Record<string, SectionSnapshot> {
  try {
    const raw = localStorage.getItem(compareSnapshotKey(projectId, docSlug))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SectionSnapshot>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function saveCurrentSnapshot(projectId: string, docSlug: string, snapshot: Record<string, SectionSnapshot>) {
  try {
    localStorage.setItem(compareSnapshotKey(projectId, docSlug), JSON.stringify(snapshot))
  } catch {
    // Non-critical if storage is unavailable.
  }
}

function computeCompareDiff(
  previous: Record<string, SectionSnapshot>,
  current: Record<string, SectionSnapshot>,
) {
  const changedIds: string[] = []
  const changedTitles: string[] = []
  const removedTitles: string[] = []

  for (const [id, section] of Object.entries(current)) {
    const prior = previous[id]
    if (!prior || prior.text !== section.text) {
      changedIds.push(id)
      changedTitles.push(section.title)
    }
  }

  for (const [id, section] of Object.entries(previous)) {
    if (!current[id]) {
      removedTitles.push(section.title)
    }
  }

  changedHeadingIds.value = changedIds
  changedSectionTitles.value = changedTitles
  removedSectionTitles.value = removedTitles
}

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
  window.addEventListener('dalil:bookmark-current', onBookmarkShortcut)
  window.addEventListener('dalil:share-current', onShareShortcut)
  window.addEventListener('dalil:toggle-compare', onToggleCompareShortcut)
  window.addEventListener('dalil:toggle-notes', onToggleNotesShortcut)
})

onUnmounted(() => {
  scrollContainer?.removeEventListener('scroll', onScroll)
  if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
  if (noteSaveTimer !== null) clearTimeout(noteSaveTimer)
  window.removeEventListener('dalil:bookmark-current', onBookmarkShortcut)
  window.removeEventListener('dalil:share-current', onShareShortcut)
  window.removeEventListener('dalil:toggle-compare', onToggleCompareShortcut)
  window.removeEventListener('dalil:toggle-notes', onToggleNotesShortcut)
})

async function fetchDocument() {
  const thisRequest = ++fetchRequestId
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
    const nextDocument = await getDocument(fullSlug)
    if (thisRequest !== fetchRequestId) return

    document.value = nextDocument
    setActiveCollection(nextDocument.collection_id)
    const relativeSlug = docSlugWithoutCollection(nextDocument.collection_id, nextDocument.slug)
    setTabTitle(
      activeProjectId.value || 'default',
      nextDocument.collection_id,
      relativeSlug,
      nextDocument.title,
    )
    if (activeProjectId.value) {
      await ensureLoaded(activeProjectId.value)
      if (thisRequest !== fetchRequestId) return
      const currentSnapshot = extractSectionSnapshot(nextDocument.content_html)
      const previousSnapshot = loadPreviousSnapshot(activeProjectId.value, nextDocument.slug)
      computeCompareDiff(previousSnapshot, currentSnapshot)
      saveCurrentSnapshot(activeProjectId.value, nextDocument.slug, currentSnapshot)
      await loadDocNotes(activeProjectId.value, nextDocument.slug)
      if (thisRequest !== fetchRequestId) return
      noteDraft.value = note.value?.note ?? ''
      lastSavedNote.value = noteDraft.value
      await markViewed(activeProjectId.value, nextDocument.slug)
    } else {
      changedHeadingIds.value = []
      changedSectionTitles.value = []
      removedSectionTitles.value = []
      noteDraft.value = ''
      lastSavedNote.value = ''
    }

    // Update window title
    window.document.title = `${nextDocument.title} \u2014 dal\u012Bl`
  } catch (e) {
    if (thisRequest === fetchRequestId) {
      error.value = e instanceof Error ? e.message : String(e)
      document.value = null
    }
  } finally {
    if (thisRequest === fetchRequestId) {
      loading.value = false
    }
  }
}

function handleRetry() {
  fetchDocument()
}

async function handleToggleBookmark() {
  if (!document.value || !activeProjectId.value) return
  const result = await toggleBookmark(
    activeProjectId.value,
    document.value.collection_id,
    document.value.slug,
    null,
    document.value.title,
  )
  addToast(result === 'added' ? 'Bookmark added' : 'Bookmark removed', 'success')
}

async function handleShareLink() {
  if (!document.value || !activeProjectId.value) return
  const deeplink = buildDeepLink({
    projectId: activeProjectId.value,
    collectionId: document.value.collection_id,
    docSlug: docSlugWithoutCollection(document.value.collection_id, document.value.slug),
  })
  try {
    await navigator.clipboard.writeText(deeplink)
    addToast('Link copied to clipboard', 'success')
  } catch {
    addToast('Could not copy link', 'error')
  }
}

async function handleBookmarkActiveSection(payload: { anchorId: string, title: string }) {
  if (!document.value || !activeProjectId.value) return
  const result = await toggleBookmark(
    activeProjectId.value,
    document.value.collection_id,
    document.value.slug,
    payload.anchorId,
    `${document.value.title} · ${payload.title}`,
  )
  addToast(result === 'added' ? `Saved #${payload.anchorId}` : `Removed #${payload.anchorId}`, 'success')
}

async function handleRemoveDocBookmark(anchorId: string | null) {
  if (!document.value || !activeProjectId.value) return
  const removed = await removeBookmark(activeProjectId.value, document.value.slug, anchorId)
  if (removed) {
    addToast(anchorId ? `Removed #${anchorId}` : 'Bookmark removed', 'success')
  }
}

function handleOpenBookmarkAnchor(anchorId: string) {
  if (!anchorId) {
    scrollToTop()
    return
  }
  const target = window.document.getElementById(anchorId)
  if (!target) {
    addToast('Section no longer exists in this document', 'info')
    return
  }
  router.replace({ hash: `#${anchorId}` }).catch(() => {})
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function handleNoteChange(value: string) {
  noteDraft.value = value
}

function scheduleNoteSave() {
  if (!document.value || !activeProjectId.value) return
  if (noteDraft.value === lastSavedNote.value) return
  const projectId = activeProjectId.value
  const docSlug = document.value.slug
  const nextNoteValue = noteDraft.value
  if (noteSaveTimer !== null) {
    clearTimeout(noteSaveTimer)
    noteSaveTimer = null
  }
  noteSaveTimer = setTimeout(async () => {
    if (!document.value || !activeProjectId.value) return
    if (activeProjectId.value !== projectId || document.value.slug !== docSlug) return
    savingNote.value = true
    try {
      await saveDocNote(projectId, docSlug, nextNoteValue)
      if (
        activeProjectId.value === projectId
        && document.value?.slug === docSlug
        && noteDraft.value === nextNoteValue
      ) {
        lastSavedNote.value = nextNoteValue
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not save note', 'error')
    } finally {
      savingNote.value = false
    }
  }, 600)
}

function inferAnchorFromSelection(selection: Selection): string | undefined {
  const anchorNode = selection.anchorNode
  if (!anchorNode) return undefined
  let element: HTMLElement | null = null
  if (anchorNode.nodeType === Node.ELEMENT_NODE) {
    element = anchorNode as HTMLElement
  } else if (anchorNode.parentElement) {
    element = anchorNode.parentElement
  }
  if (!element) return undefined
  const heading = element.closest('h2[id], h3[id]') as HTMLElement | null
  return heading?.id
}

async function handleAddHighlightFromSelection() {
  if (!document.value || !activeProjectId.value) return
  const selection = window.getSelection()
  const selectedText = selection?.toString().trim() ?? ''
  if (!selectedText) {
    addToast('Select text in the document first', 'info')
    return
  }
  try {
    const anchorId = selection ? inferAnchorFromSelection(selection) : undefined
    await addHighlight(
      activeProjectId.value,
      document.value.slug,
      selectedText,
      anchorId,
      selectedText.slice(0, 240),
    )
    addToast('Highlight saved', 'success')
    selection?.removeAllRanges()
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not save highlight', 'error')
  }
}

async function handleDeleteHighlight(id: number) {
  try {
    await removeHighlight(id)
    addToast('Highlight removed', 'success')
  } catch (e) {
    addToast(e instanceof Error ? e.message : 'Could not remove highlight', 'error')
  }
}

function onBookmarkShortcut() {
  if (!document.value) return
  handleToggleBookmark().catch(() => {})
}

function onShareShortcut() {
  if (!document.value) return
  handleShareLink().catch(() => {})
}

function onToggleCompareShortcut() {
  if (!document.value) return
  compareModeEnabled.value = !compareModeEnabled.value
}

function onToggleNotesShortcut() {
  if (!document.value) return
  focusNoteToken.value += 1
}

watch(
  () => [route.params.collection, route.params.slug],
  () => {
    if (noteSaveTimer !== null) {
      clearTimeout(noteSaveTimer)
      noteSaveTimer = null
    }
    fetchDocument()
  },
  { immediate: true },
)

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (projectId) ensureLoaded(projectId).catch(() => {})
  },
  { immediate: true },
)

watch(noteDraft, () => {
  scheduleNoteSave()
})
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

  <div class="flex gap-10 xl:gap-14">
    <div class="min-w-0 flex-1">
      <!-- Loading skeleton -->
      <div v-if="loading" class="animate-pulse">
        <div class="ui-skeleton-bar h-4 w-1/4 mb-6" />
        <div class="ui-skeleton-bar h-8 w-1/3 mb-8" />
        <div class="space-y-4">
          <div class="ui-skeleton-bar h-4 w-full" />
          <div class="ui-skeleton-bar h-4 w-5/6" />
          <div class="ui-skeleton-bar h-4 w-4/6" />
        </div>
        <div class="mt-8 space-y-4">
          <div class="ui-skeleton-bar h-4 w-full" />
          <div class="ui-skeleton-bar h-4 w-3/4" />
          <div class="ui-skeleton-bar h-4 w-5/6" />
          <div class="ui-skeleton-bar h-4 w-2/3" />
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
        <Breadcrumbs :document="document" class="mb-3 px-1" />
        <ContentHeader
          :document="document"
          @share-link="handleShareLink"
        />

        <div class="mb-5 rounded-xl border border-border/60 bg-surface/45 backdrop-blur-xl px-3.5 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.85)]">
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="inline-flex h-8 items-center rounded-md border border-border/60 bg-surface-secondary/30 px-3 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
              :class="compareModeEnabled ? 'bg-accent/10 text-accent border-accent/30' : ''"
              @click="compareModeEnabled = !compareModeEnabled"
            >
              {{ compareModeEnabled ? 'Compare mode on' : 'Compare mode off' }}
            </button>
            <span class="inline-flex h-8 items-center rounded-md border border-border/60 bg-surface-secondary/24 px-3 text-xs text-text-secondary tabular-nums">
              {{ changedSectionsLabel }}
            </span>
          </div>
        </div>

        <DocumentView
          :document="document"
          :compare-mode="compareModeEnabled"
          :changed-heading-ids="changedHeadingIds"
        />

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

    <DocRightSidebar
      v-if="document && !loading"
      :document="document"
      :content-key="document.slug"
      :bookmarked="bookmarked"
      :doc-bookmarks="docBookmarks"
      :note-draft="noteDraft"
      :note-saving="savingNote"
      :highlights="highlights"
      :changed-section-titles="changedSectionTitles"
      :removed-section-titles="removedSectionTitles"
      :focus-note-token="focusNoteToken"
      :show-back-to-top="showBackToTop"
      @toggle-page-bookmark="handleToggleBookmark"
      @bookmark-active-section="handleBookmarkActiveSection"
      @open-bookmark-anchor="handleOpenBookmarkAnchor"
      @remove-bookmark="handleRemoveDocBookmark"
      @note-change="handleNoteChange"
      @add-highlight="handleAddHighlightFromSelection"
      @remove-highlight="handleDeleteHighlight"
      @scroll-top="scrollToTop"
    />
  </div>
</template>
