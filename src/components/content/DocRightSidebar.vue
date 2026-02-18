<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useTableOfContents } from '@/composables/useTableOfContents'
import type { Bookmark, DocHighlight, Document } from '@/lib/types'

const props = defineProps<{
  document: Document
  contentKey: string
  bookmarked: boolean
  docBookmarks: Bookmark[]
  noteDraft: string
  noteSaving: boolean
  highlights: DocHighlight[]
  changedSectionTitles: string[]
  removedSectionTitles: string[]
  focusNoteToken: number
  showBackToTop: boolean
}>()

const emit = defineEmits<{
  'toggle-page-bookmark': []
  'bookmark-active-section': [payload: { anchorId: string, title: string }]
  'open-bookmark-anchor': [anchorId: string]
  'remove-bookmark': [anchorId: string | null]
  'note-change': [value: string]
  'add-highlight': []
  'remove-highlight': [id: number]
  'scroll-top': []
}>()

const { headings, activeId, scrollToHeading, refresh } = useTableOfContents('.prose')
const noteInputRef = ref<HTMLTextAreaElement | null>(null)

const activeHeading = computed(() =>
  headings.value.find((heading) => heading.id === activeId.value) ?? null,
)

const sortedDocBookmarks = computed(() =>
  [...props.docBookmarks].sort((a, b) => b.updatedAt - a.updatedAt),
)

watch(
  () => props.contentKey,
  () => {
    refresh()
  },
)

watch(
  () => props.focusNoteToken,
  async () => {
    await nextTick()
    noteInputRef.value?.focus()
  },
)

function handleBookmarkActiveSection() {
  if (!activeHeading.value) return
  emit('bookmark-active-section', {
    anchorId: activeHeading.value.id,
    title: activeHeading.value.text,
  })
}

function onNoteInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  emit('note-change', value)
}
</script>

<template>
  <aside
    class="hidden lg:block sticky top-[96px] w-[21rem] shrink-0 max-h-[calc(100vh-140px)] overflow-y-auto overscroll-contain space-y-4 pl-1 pr-2 pb-8 mb-4"
    aria-label="Document tools"
  >
    <section class="rounded-xl border border-border/60 bg-surface/52 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)] p-3.5">
      <div class="mb-2.5 flex items-center justify-between gap-2">
        <p class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          <svg class="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 6.75h15m-15 5.25h15m-15 5.25h9" />
          </svg>
          On this page
        </p>
        <span class="rounded-full border border-border/70 bg-surface-secondary/30 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
          {{ headings.length }}
        </span>
      </div>
      <div v-if="headings.length === 0" class="text-xs text-text-secondary">
        No headings found.
      </div>
      <ul v-else class="space-y-0.5 pr-1">
        <li
          v-for="heading in headings"
          :key="heading.id"
        >
          <button
            class="block w-full rounded-md px-2 py-1 text-left text-[13px] leading-5 transition-colors truncate"
            :class="[
              heading.level === 3 ? 'pl-5 text-[12px]' : '',
              activeId === heading.id
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary/50',
            ]"
            @click="scrollToHeading(heading.id)"
          >
            {{ heading.text }}
          </button>
        </li>
      </ul>
    </section>

    <section class="rounded-xl border border-border/60 bg-surface/52 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)] p-3.5">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <div class="inline-flex items-center gap-1.5">
          <p class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            <svg class="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 3.75H6.75A2.25 2.25 0 004.5 6v14.25l7.5-4.5 7.5 4.5V6a2.25 2.25 0 00-2.25-2.25z" />
            </svg>
            Bookmarks
          </p>
          <span class="rounded-full border border-border/70 bg-surface-secondary/30 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            {{ sortedDocBookmarks.length }}
          </span>
        </div>
        <button
          class="rounded border border-border/70 bg-surface-secondary/25 px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          :class="bookmarked ? 'bg-accent/10 text-accent border-accent/30' : ''"
          @click="emit('toggle-page-bookmark')"
        >
          {{ bookmarked ? 'Bookmarked' : 'Bookmark page' }}
        </button>
      </div>

      <button
        class="w-full rounded border border-border/70 bg-surface-secondary/20 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors mb-2.5"
        :disabled="!activeHeading"
        :class="!activeHeading ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-text-secondary' : ''"
        @click="handleBookmarkActiveSection"
      >
        {{ activeHeading ? `Bookmark #${activeHeading.id}` : 'Scroll to a section to bookmark it' }}
      </button>

      <div v-if="sortedDocBookmarks.length === 0" class="text-xs text-text-secondary">
        No bookmarks for this document.
      </div>
      <div v-else class="space-y-1.5">
        <div
          v-for="bookmark in sortedDocBookmarks"
          :key="bookmark.id"
          class="rounded-lg border border-border/60 bg-surface-secondary/28 p-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              class="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-text-secondary hover:text-accent truncate"
              @click="emit('open-bookmark-anchor', bookmark.anchorId ?? '')"
            >
              {{ bookmark.anchorId ? `#${bookmark.anchorId}` : 'This page' }}
            </button>
            <button
              class="text-[10px] font-medium text-text-secondary hover:text-text-primary"
              @click="emit('remove-bookmark', bookmark.anchorId)"
            >
              Remove
            </button>
          </div>
          <p class="text-xs text-text-primary truncate mt-1">{{ bookmark.titleSnapshot }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-border/60 bg-surface/52 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)] p-3.5">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <p class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          <svg class="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 19.5h13.5a1.5 1.5 0 001.5-1.5v-9.75l-4.5-4.5H5.25a1.5 1.5 0 00-1.5 1.5V18a1.5 1.5 0 001.5 1.5z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 10.5h6m-6 3h6" />
          </svg>
          Personal note
        </p>
        <span
          class="rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
          :class="noteSaving
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
            : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-500'"
        >
          {{ noteSaving ? 'Saving' : 'Saved' }}
        </span>
      </div>
      <textarea
        ref="noteInputRef"
        :value="noteDraft"
        rows="5"
        placeholder="Write private notes for this document..."
        class="w-full rounded-lg border border-border/70 bg-surface-secondary/45 px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        @input="onNoteInput"
      />
    </section>

    <section class="rounded-xl border border-border/60 bg-surface/52 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)] p-3.5">
      <div class="flex items-center justify-between gap-2 mb-2.5">
        <div class="inline-flex items-center gap-1.5">
          <p class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            <svg class="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-2.846.813 8.358-8.358 2.846-.813-.813 2.846-8.358 8.358z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.512 6.488l3 3" />
            </svg>
            Highlights
          </p>
          <span class="rounded-full border border-border/70 bg-surface-secondary/30 px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
            {{ highlights.length }}
          </span>
        </div>
        <button
          class="rounded border border-border/70 bg-surface-secondary/25 px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          @click="emit('add-highlight')"
        >
          Add from selection
        </button>
      </div>

      <div v-if="highlights.length === 0" class="text-xs text-text-secondary">
        No highlights yet.
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="highlight in highlights"
          :key="highlight.id"
          class="rounded-lg border border-border/60 bg-surface-secondary/30 p-2.5"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-[13px] leading-5 text-text-primary whitespace-pre-wrap">{{ highlight.selectedText }}</p>
            <button
              class="text-[10px] font-medium text-text-secondary hover:text-text-primary"
              @click="emit('remove-highlight', highlight.id)"
            >
              Delete
            </button>
          </div>
          <p v-if="highlight.anchorId" class="text-[11px] text-text-secondary mt-1">
            Section: #{{ highlight.anchorId }}
          </p>
        </div>
      </div>
    </section>

    <section
      v-if="changedSectionTitles.length > 0 || removedSectionTitles.length > 0"
      class="rounded-xl border border-border/60 bg-surface/52 backdrop-blur-xl shadow-[0_10px_30px_-24px_rgba(0,0,0,0.85)] p-3.5"
    >
      <p class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-2.5">
        <svg class="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 5.25h9m-9 6.75h9m-9 6.75h6" />
        </svg>
        Compare
      </p>
      <div v-if="changedSectionTitles.length > 0">
        <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-1">Changed sections</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="title in changedSectionTitles.slice(0, 8)"
            :key="title"
            class="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px]"
          >
            {{ title }}
          </span>
        </div>
      </div>

      <div v-if="removedSectionTitles.length > 0" class="mt-2">
        <p class="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-1">Removed sections</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="title in removedSectionTitles.slice(0, 6)"
            :key="`removed-${title}`"
            class="rounded-full bg-surface-secondary text-text-secondary px-2 py-0.5 text-[11px]"
          >
            {{ title }}
          </span>
        </div>
      </div>
    </section>

    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <button
        v-if="showBackToTop"
        class="fixed bottom-5 right-6 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-surface/75 shadow-lg backdrop-blur text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
        title="Back to top"
        @click="emit('scroll-top')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
    </Transition>
  </aside>
</template>
