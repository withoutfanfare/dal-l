<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useDocHistory } from '@/composables/useDocHistory'
import { useDocActivity } from '@/composables/useDocActivity'
import { docSlugWithoutCollection } from '@/lib/deepLinks'

const router = useRouter()
const { activeProjectId } = useProjects()
const { canGoBack, canGoForward, goBack, goForward } = useDocHistory()
const { recentDocuments, load: loadActivity } = useDocActivity()

const recentOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const recentItems = computed(() => recentDocuments.value.slice(0, 10))

function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  return date.toLocaleDateString()
}

function toggleRecent() {
  recentOpen.value = !recentOpen.value
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

function onDocumentClick(event: MouseEvent) {
  if (!recentOpen.value || !rootRef.value) return
  const target = event.target as Node
  if (!rootRef.value.contains(target)) {
    recentOpen.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && recentOpen.value) {
    recentOpen.value = false
  }
}

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (!projectId) return
    loadActivity(projectId).catch(() => {})
  },
  { immediate: true },
)

onMounted(() => {
  window.document.addEventListener('click', onDocumentClick)
  window.document.addEventListener('keydown', onDocumentKeydown)
})

onUnmounted(() => {
  window.document.removeEventListener('click', onDocumentClick)
  window.document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative flex items-center gap-1">
    <button
      class="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary border border-border/60 bg-surface-secondary/40 hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Back"
      :disabled="!canGoBack"
      @click="handleBack"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>

    <button
      class="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary border border-border/60 bg-surface-secondary/40 hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Forward"
      :disabled="!canGoForward"
      @click="handleForward"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>

    <button
      class="h-7 px-2 rounded-md text-xs font-medium transition-colors border border-border/60 bg-surface-secondary/40 text-text-secondary hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border inline-flex items-center gap-1"
      title="Recently viewed"
      @click="toggleRecent"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
      Recent
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
        class="absolute right-0 top-9 z-[120] w-[360px] max-w-[70vw] rounded-xl border border-border bg-surface shadow-2xl"
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
              class="w-full text-left rounded-md px-2 py-1.5 hover:bg-surface-secondary transition-colors"
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
  </div>
</template>
