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
}>()

const emit = defineEmits<{
  'toggle-page-bookmark': []
  'bookmark-active-section': [payload: { anchorId: string, title: string }]
  'open-bookmark-anchor': [anchorId: string]
  'remove-bookmark': [anchorId: string | null]
  'note-change': [value: string]
  'add-highlight': []
  'remove-highlight': [id: number]
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
    class="hidden lg:block sticky top-[68px] w-80 shrink-0 max-h-[calc(100vh-84px)] overflow-y-auto space-y-4"
    aria-label="Document tools"
  >
    <section class="rounded-lg border border-border bg-surface p-3">
      <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">On this page</p>
      <div v-if="headings.length === 0" class="text-xs text-text-secondary">
        No headings found.
      </div>
      <ul v-else class="space-y-1">
        <li
          v-for="heading in headings"
          :key="heading.id"
        >
          <button
            class="block w-full text-left text-sm leading-relaxed transition-colors truncate"
            :class="[
              heading.level === 3 ? 'pl-3' : '',
              activeId === heading.id
                ? 'text-accent font-medium'
                : 'text-text-secondary hover:text-text-primary',
            ]"
            @click="scrollToHeading(heading.id)"
          >
            {{ heading.text }}
          </button>
        </li>
      </ul>
    </section>

    <section class="rounded-lg border border-border bg-surface p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Bookmarks</p>
        <button
          class="rounded border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
          :class="bookmarked ? 'bg-accent/10 text-accent border-accent/30' : ''"
          @click="emit('toggle-page-bookmark')"
        >
          {{ bookmarked ? 'Bookmarked' : 'Bookmark page' }}
        </button>
      </div>

      <button
        class="w-full rounded border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors mb-2"
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
          class="rounded border border-border bg-surface-secondary/40 p-2"
        >
          <div class="flex items-start justify-between gap-2">
            <button
              class="text-left text-xs font-medium text-text-primary hover:text-accent truncate"
              @click="emit('open-bookmark-anchor', bookmark.anchorId ?? '')"
            >
              {{ bookmark.anchorId ? `#${bookmark.anchorId}` : 'This page' }}
            </button>
            <button
              class="text-[11px] text-text-secondary hover:text-text-primary"
              @click="emit('remove-bookmark', bookmark.anchorId)"
            >
              Remove
            </button>
          </div>
          <p class="text-[11px] text-text-secondary truncate mt-1">{{ bookmark.titleSnapshot }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-surface p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Personal note</p>
        <span class="text-[11px] text-text-secondary">{{ noteSaving ? 'Saving...' : 'Saved' }}</span>
      </div>
      <textarea
        ref="noteInputRef"
        :value="noteDraft"
        rows="5"
        placeholder="Write private notes for this document..."
        class="w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        @input="onNoteInput"
      />
    </section>

    <section class="rounded-lg border border-border bg-surface p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Highlights</p>
        <button
          class="rounded border border-border px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
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
          class="rounded border border-border bg-surface-secondary/50 p-2"
        >
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm text-text-primary whitespace-pre-wrap">{{ highlight.selectedText }}</p>
            <button
              class="text-[11px] text-text-secondary hover:text-text-primary"
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
      class="rounded-lg border border-border bg-surface p-3"
    >
      <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Compare</p>
      <div v-if="changedSectionTitles.length > 0">
        <p class="text-[11px] uppercase tracking-wider text-text-secondary mb-1">Changed sections</p>
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
        <p class="text-[11px] uppercase tracking-wider text-text-secondary mb-1">Removed sections</p>
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
  </aside>
</template>
