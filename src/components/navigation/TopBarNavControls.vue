<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useDocHistory } from '@/composables/useDocHistory'
import { useDocActivity } from '@/composables/useDocActivity'
import { docSlugWithoutCollection } from '@/lib/deepLinks'
import { getProjectChangeFeed } from '@/lib/api'
import type { ProjectChangeFeedItem } from '@/lib/types'

const router = useRouter()
const { activeProjectId } = useProjects()
const { canGoBack, canGoForward, goBack, goForward } = useDocHistory()
const { recentDocuments, updatedSlugs, load: loadActivity } = useDocActivity()

const recentOpen = ref(false)
const changesOpen = ref(false)
const changeFeed = ref<ProjectChangeFeedItem[]>([])
const loadingChanges = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const recentItems = computed(() => recentDocuments.value.slice(0, 10))
const latestChanges = computed(() => changeFeed.value.slice(0, 12))
const unreadChangedDocCount = computed(() => {
  const unique = new Set<string>()
  for (const entry of latestChanges.value) {
    for (const docSlug of entry.changedDocSlugs) {
      if (updatedSlugs.value.has(docSlug)) unique.add(docSlug)
    }
  }
  return unique.size
})

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  return date.toLocaleDateString()
}

function toggleRecent() {
  recentOpen.value = !recentOpen.value
  if (recentOpen.value) changesOpen.value = false
}

async function toggleChanges() {
  changesOpen.value = !changesOpen.value
  if (changesOpen.value) {
    recentOpen.value = false
    await loadChangeFeed()
  }
}

function handleBack() {
  goBack(router)
}

function handleForward() {
  goForward(router)
}

function openRecentDoc(collectionId: string, docSlug: string) {
  recentOpen.value = false
  router.push({
    name: 'doc',
    params: {
      collection: collectionId,
      slug: docSlugWithoutCollection(collectionId, docSlug),
    },
  }).catch(() => {})
}

function openChangedDoc(docSlug: string) {
  const parts = docSlug.split('/').filter(Boolean)
  const collectionId = parts[0]
  if (!collectionId) return
  changesOpen.value = false
  router.push({
    name: 'doc',
    params: {
      collection: collectionId,
      slug: docSlugWithoutCollection(collectionId, docSlug),
    },
  }).catch(() => {})
}

function isChangedDocUnread(docSlug: string): boolean {
  return updatedSlugs.value.has(docSlug)
}

function entryUnreadCount(entry: ProjectChangeFeedItem): number {
  let count = 0
  for (const docSlug of entry.changedDocSlugs) {
    if (updatedSlugs.value.has(docSlug)) count += 1
  }
  return count
}

async function loadChangeFeed() {
  const projectId = activeProjectId.value
  if (!projectId) {
    changeFeed.value = []
    return
  }
  loadingChanges.value = true
  try {
    changeFeed.value = await getProjectChangeFeed(projectId, 20)
  } finally {
    loadingChanges.value = false
  }
}

function shortHash(hash: string): string {
  return hash.slice(0, 7)
}

function formatCommittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function onDocumentClick(event: MouseEvent) {
  if ((!recentOpen.value && !changesOpen.value) || !rootRef.value) return
  const target = event.target as Node
  if (!rootRef.value.contains(target)) {
    recentOpen.value = false
    changesOpen.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && (recentOpen.value || changesOpen.value)) {
    recentOpen.value = false
    changesOpen.value = false
  }
}

function openRecentPanel() {
  recentOpen.value = true
  changesOpen.value = false
}

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (!projectId) {
      changeFeed.value = []
      return
    }
    loadActivity(projectId).catch(() => {})
    loadChangeFeed().catch(() => {})
  },
  { immediate: true },
)

onMounted(() => {
  window.document.addEventListener('click', onDocumentClick)
  window.document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('dalil:open-recent-panel', openRecentPanel)
})

onUnmounted(() => {
  window.document.removeEventListener('click', onDocumentClick)
  window.document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('dalil:open-recent-panel', openRecentPanel)
})
</script>

<template>
  <div ref="rootRef" class="relative flex items-center gap-1">
    <button
      class="topbar-chip-btn flex items-center justify-center w-7 h-7 rounded-md disabled:cursor-not-allowed"
      title="Back"
      :disabled="!canGoBack"
      @click="handleBack"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>

    <button
      class="topbar-chip-btn flex items-center justify-center w-7 h-7 rounded-md disabled:cursor-not-allowed"
      title="Forward"
      :disabled="!canGoForward"
      @click="handleForward"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>

    <button
      class="topbar-chip-btn h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1"
      :data-open="recentOpen ? 'true' : 'false'"
      title="Recently viewed"
      @click="toggleRecent"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
      Recent
    </button>

    <button
      class="topbar-chip-btn h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1"
      :data-open="changesOpen ? 'true' : 'false'"
      title="What changed"
      @click="toggleChanges"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10m-6 6h2" />
      </svg>
      Changes
      <span
        v-if="unreadChangedDocCount > 0"
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/20 px-1 text-[10px] font-semibold text-accent"
      >
        {{ unreadChangedDocCount }}
      </span>
    </button>

    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0 scale-[0.98] -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-[0.98] -translate-y-1"
    >
      <div
        v-if="recentOpen"
        class="absolute left-0 top-9 z-[120] w-[360px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div class="px-3 py-2 border-b border-border">
          <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Recently viewed</p>
        </div>
        <div class="max-h-[320px] overflow-y-auto p-2">
          <div v-if="recentItems.length === 0" class="px-2 py-4 text-xs text-text-secondary">
            No recent documents yet.
          </div>
          <div v-else class="space-y-1">
            <button
              v-for="item in recentItems"
              :key="item.docSlug"
              class="topbar-menu-item w-full text-left rounded-md px-2 py-1.5"
              @click="openRecentDoc(item.collectionId, item.docSlug)"
            >
              <p class="text-xs font-medium text-text-primary truncate">{{ item.title }}</p>
              <p class="text-[11px] text-text-secondary truncate mt-0.5">{{ item.collectionId }} · {{ item.section || item.docSlug }}</p>
              <p class="text-[10px] text-text-secondary/70 mt-0.5">{{ formatDate(item.lastViewedAt) }}</p>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0 scale-[0.98] -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-[0.98] -translate-y-1"
    >
      <div
        v-if="changesOpen"
        class="absolute left-0 top-9 z-[120] w-[420px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-2xl"
      >
        <div class="px-3 py-2 border-b border-border">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">What changed</p>
            <span v-if="unreadChangedDocCount > 0" class="text-[10px] text-accent font-medium">
              {{ unreadChangedDocCount }} new doc{{ unreadChangedDocCount === 1 ? '' : 's' }}
            </span>
          </div>
          <p class="mt-1 text-[10px] text-text-secondary/80">
            “New” matches docs marked as updated in the sidebar.
          </p>
        </div>
        <div class="max-h-[340px] overflow-y-auto p-2">
          <div v-if="loadingChanges" class="px-2 py-4 text-xs text-text-secondary">
            Loading changes...
          </div>
          <div v-else-if="latestChanges.length === 0" class="px-2 py-4 text-xs text-text-secondary">
            No change feed data available yet.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="entry in latestChanges"
              :key="entry.id"
              class="rounded-md border border-border bg-surface-secondary/40 p-2"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs font-medium text-text-primary">
                  {{ shortHash(entry.commitHash) }} · {{ entry.author }}
                </p>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="entryUnreadCount(entry) > 0"
                    class="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                  >
                    {{ entryUnreadCount(entry) }} new
                  </span>
                  <p class="text-[10px] text-text-secondary">{{ formatCommittedAt(entry.committedAt) }}</p>
                </div>
              </div>
              <div v-if="entry.changedDocSlugs.length > 0" class="mt-1.5 flex flex-wrap gap-1">
                <button
                  v-for="docSlug in entry.changedDocSlugs.slice(0, 6)"
                  :key="`${entry.id}-${docSlug}`"
                  class="rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                  :class="isChangedDocUnread(docSlug)
                    ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/15'
                    : 'border-border text-text-secondary hover:text-text-primary hover:bg-surface'"
                  @click="openChangedDoc(docSlug)"
                >
                  <span>{{ docSlug }}</span>
                  <span v-if="isChangedDocUnread(docSlug)" class="ml-1 uppercase tracking-wide text-[9px] font-semibold">new</span>
                </button>
              </div>
              <p v-else class="text-[10px] text-text-secondary mt-1.5">
                No mapped docs for this commit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
