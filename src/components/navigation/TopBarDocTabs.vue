<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useCollections } from '@/composables/useCollections'
import { useDocTabs } from '@/composables/useDocTabs'
import { buildTabMenu } from '@/lib/tabMenu'

const route = useRoute()
const router = useRouter()
const { activeProjectId } = useProjects()
const { activeCollectionId } = useCollections()
const {
  getTabs,
  getActiveSlug,
  closeTab,
  setActiveTab,
  beginNewTab,
  isNewTabPending,
  clearCollectionTabs,
  moveTab,
  getAdjacentSlug,
} = useDocTabs()
const draggingSlug = ref<string | null>(null)
const tabsScrollContainer = ref<HTMLElement | null>(null)
const showScrollLeft = ref(false)
const showScrollRight = ref(false)
const tabsMenuOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const tabsMenuQuery = ref('')
const tabsMenuSearchInput = ref<HTMLInputElement | null>(null)

const projectKey = computed(() => activeProjectId.value || 'default')

const currentCollectionId = computed(() => {
  const routeCollection = route.params.collection
  const routeValue = Array.isArray(routeCollection) ? routeCollection[0] : routeCollection
  return routeValue || activeCollectionId.value || ''
})

const routeSlug = computed(() => {
  const raw = route.params.slug
  if (!raw) return ''
  const slug = Array.isArray(raw) ? raw.join('/') : raw
  return slug || ''
})

const tabs = computed(() => {
  if (!currentCollectionId.value) return []
  return getTabs(projectKey.value, currentCollectionId.value)
})

const activeSlug = computed(() => {
  if (!currentCollectionId.value) return null
  return routeSlug.value || getActiveSlug(projectKey.value, currentCollectionId.value)
})

const showTabs = computed(() =>
  (route.name === 'doc' || route.name === 'springboard') && tabs.value.length > 0,
)
const showOverflowMenu = computed(() =>
  tabs.value.length > 8 || showScrollLeft.value || showScrollRight.value,
)
const menuState = computed(() =>
  buildTabMenu(tabs.value, {
    scope: 'all',
    query: tabsMenuQuery.value,
  }),
)
const menuTabs = computed(() => menuState.value.tabs)
const menuTotal = computed(() => menuState.value.total)
const menuHiddenCount = computed(() => menuState.value.hiddenCount)
const newTabPending = computed(() => {
  if (!currentCollectionId.value) return false
  return isNewTabPending(projectKey.value, currentCollectionId.value)
})

function openTab(slug: string) {
  if (!currentCollectionId.value) return
  setActiveTab(projectKey.value, currentCollectionId.value, slug)
  router.push({
    name: 'doc',
    params: {
      collection: currentCollectionId.value,
      slug,
    },
  }).catch(() => {})
}

function closeSingleTab(slug: string) {
  if (!currentCollectionId.value) return

  const wasActive = activeSlug.value === slug
  const nextSlug = closeTab(projectKey.value, currentCollectionId.value, slug)

  if (wasActive) {
    if (nextSlug) {
      router.push({
        name: 'doc',
        params: {
          collection: currentCollectionId.value,
          slug: nextSlug,
        },
      }).catch(() => {})
    } else {
      router.push({
        name: 'springboard',
        params: { collection: currentCollectionId.value },
      }).catch(() => {})
    }
  }
}

function closeAllTabs() {
  if (!currentCollectionId.value) return
  clearCollectionTabs(projectKey.value, currentCollectionId.value)
  router.push({
    name: 'springboard',
    params: { collection: currentCollectionId.value },
  }).catch(() => {})
  tabsMenuOpen.value = false
  tabsMenuQuery.value = ''
}

function startNewTab() {
  const collectionId = currentCollectionId.value || activeCollectionId.value || ''
  if (!collectionId) return
  beginNewTab(projectKey.value, collectionId)
  router.push({
    name: 'springboard',
    params: { collection: collectionId },
    query: { from: route.fullPath },
  }).catch(() => {})
}

function encodedSlug(slug: string): string {
  return encodeURIComponent(slug)
}

function updateOverflowState() {
  const element = tabsScrollContainer.value
  if (!element) {
    showScrollLeft.value = false
    showScrollRight.value = false
    return
  }
  const maxOffset = Math.max(0, element.scrollWidth - element.clientWidth)
  showScrollLeft.value = element.scrollLeft > 4
  showScrollRight.value = (maxOffset - element.scrollLeft) > 4
}

function onTabsScroll() {
  updateOverflowState()
}

function scrollTabs(direction: -1 | 1) {
  const element = tabsScrollContainer.value
  if (!element) return
  const delta = Math.max(180, Math.floor(element.clientWidth * 0.55))
  element.scrollBy({ left: delta * direction, behavior: 'smooth' })
  window.setTimeout(updateOverflowState, 170)
}

function ensureTabVisible(slug: string) {
  const element = tabsScrollContainer.value
  if (!element) return
  const target = element.querySelector<HTMLElement>(`[data-tab-slug="${encodedSlug(slug)}"]`)
  target?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
}

function toggleTabsMenu() {
  tabsMenuOpen.value = !tabsMenuOpen.value
  if (tabsMenuOpen.value) {
    nextTick(() => tabsMenuSearchInput.value?.focus())
  } else {
    tabsMenuQuery.value = ''
  }
}

function openFromMenu(slug: string) {
  tabsMenuOpen.value = false
  tabsMenuQuery.value = ''
  openTab(slug)
}

function closeFromMenu(slug: string) {
  closeSingleTab(slug)
}

function clearTabsMenuQuery() {
  tabsMenuQuery.value = ''
  nextTick(() => tabsMenuSearchInput.value?.focus())
}

function openFirstMenuMatch() {
  const first = menuTabs.value[0]
  if (!first) return
  openFromMenu(first.slug)
}

function onDocumentClick(event: MouseEvent) {
  if (!tabsMenuOpen.value || !rootRef.value) return
  const target = event.target as Node
  if (!rootRef.value.contains(target)) {
    tabsMenuOpen.value = false
    tabsMenuQuery.value = ''
  }
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && tabsMenuOpen.value) {
    tabsMenuOpen.value = false
    tabsMenuQuery.value = ''
  }
}

function onDragStart(slug: string) {
  draggingSlug.value = slug
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

function onDrop(targetSlug: string) {
  if (!currentCollectionId.value || !draggingSlug.value) return
  const targetIndex = tabs.value.findIndex((item) => item.slug === targetSlug)
  if (targetIndex < 0) return
  moveTab(projectKey.value, currentCollectionId.value, draggingSlug.value, targetIndex)
}

function onDragEnd() {
  draggingSlug.value = null
}

function switchToAdjacent(direction: -1 | 1) {
  if (!currentCollectionId.value || !activeSlug.value) return
  const next = getAdjacentSlug(projectKey.value, currentCollectionId.value, activeSlug.value, direction)
  if (!next) return
  openTab(next)
}

function onNextTab() {
  switchToAdjacent(1)
}

function onPrevTab() {
  switchToAdjacent(-1)
}

function onNewTabIntent() {
  startNewTab()
}

onMounted(() => {
  window.addEventListener('dalil:tab-next', onNextTab)
  window.addEventListener('dalil:tab-prev', onPrevTab)
  window.addEventListener('dalil:new-tab-intent', onNewTabIntent)
  window.addEventListener('resize', updateOverflowState)
  window.document.addEventListener('click', onDocumentClick)
  window.document.addEventListener('keydown', onDocumentKeydown)
  nextTick(updateOverflowState)
})

onUnmounted(() => {
  window.removeEventListener('dalil:tab-next', onNextTab)
  window.removeEventListener('dalil:tab-prev', onPrevTab)
  window.removeEventListener('dalil:new-tab-intent', onNewTabIntent)
  window.removeEventListener('resize', updateOverflowState)
  window.document.removeEventListener('click', onDocumentClick)
  window.document.removeEventListener('keydown', onDocumentKeydown)
})

watch(
  () => tabs.value.length,
  () => {
    nextTick(updateOverflowState)
  },
)

watch(
  () => activeSlug.value,
  (slug) => {
    if (!slug) return
    nextTick(() => {
      ensureTabVisible(slug)
      updateOverflowState()
    })
  },
)
</script>

<template>
  <div
    v-if="showTabs"
    ref="rootRef"
    class="sticky top-0 z-30 h-[36px] border-b border-border/65 bg-surface/74 backdrop-blur-xl"
    style="-webkit-app-region: no-drag"
  >
    <div class="h-full flex items-center gap-1 px-2">
      <button
        v-if="showScrollLeft"
        class="flex h-7 w-7 items-center justify-center rounded-md border border-border/55 bg-surface-secondary/35 text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
        title="Scroll tabs left"
        @click="scrollTabs(-1)"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <div
        ref="tabsScrollContainer"
        class="min-w-0 flex-1 overflow-x-auto no-scrollbar"
        @scroll="onTabsScroll"
      >
        <div class="inline-flex items-center gap-1 pr-2">
          <div
            v-for="tab in tabs"
            :key="tab.slug"
            class="group inline-flex items-center gap-1 rounded-md px-2 h-7 text-xs border transition-colors max-w-[260px]"
            :class="activeSlug === tab.slug
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border/70 bg-surface-secondary/35 text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
            :data-tab-slug="encodedSlug(tab.slug)"
            role="button"
            tabindex="0"
            draggable="true"
            @click="openTab(tab.slug)"
            @keydown.enter.prevent="openTab(tab.slug)"
            @keydown.space.prevent="openTab(tab.slug)"
            @dragstart="onDragStart(tab.slug)"
            @dragover="onDragOver"
            @drop="onDrop(tab.slug)"
            @dragend="onDragEnd"
          >
            <span class="truncate">{{ tab.title }}</span>
            <button
              class="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] text-text-secondary/80 hover:text-text-primary hover:bg-black/10 transition-colors"
              title="Close tab"
              @click.stop="closeSingleTab(tab.slug)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <button
        v-if="showScrollRight"
        class="flex h-7 w-7 items-center justify-center rounded-md border border-border/55 bg-surface-secondary/35 text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
        title="Scroll tabs right"
        @click="scrollTabs(1)"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <button
        class="h-7 w-7 rounded-md border text-xs transition-colors inline-flex items-center justify-center"
        :class="newTabPending
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border/55 bg-surface-secondary/35 text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
        title="New tab (Cmd/Ctrl+T), then pick a document"
        @click="startNewTab"
      >
        +
      </button>

      <div v-if="showOverflowMenu" class="relative">
        <button
          class="h-7 px-2 rounded-md border border-border/55 bg-surface-secondary/35 text-text-secondary text-xs hover:text-text-primary hover:bg-surface-secondary transition-colors inline-flex items-center gap-1"
          title="All tabs"
          @click="toggleTabsMenu"
        >
          Tabs
          <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface px-1 text-[10px] text-text-primary">
            {{ tabs.length }}
          </span>
        </button>
        <Transition
          enter-active-class="duration-120 ease-out"
          enter-from-class="opacity-0 scale-[0.98] -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.98] -translate-y-1"
        >
          <div
            v-if="tabsMenuOpen"
            class="absolute right-0 top-9 z-[120] w-[320px] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-2xl"
          >
            <div class="flex items-center justify-between border-b border-border px-3 py-2">
              <p class="text-xs font-semibold uppercase tracking-wider text-text-secondary">Open tabs</p>
              <div class="flex items-center gap-2">
                <button
                  class="text-[11px] text-text-secondary hover:text-text-primary"
                  @click="closeAllTabs"
                >
                  Close all
                </button>
              </div>
            </div>
            <div class="border-b border-border px-3 py-1.5">
              <div class="mb-1.5 flex items-center justify-between gap-2">
                <p class="text-[11px] text-text-secondary">
                  {{ menuTotal }} match{{ menuTotal === 1 ? '' : 'es' }}
                </p>
              </div>
              <div class="relative">
                <input
                  ref="tabsMenuSearchInput"
                  v-model="tabsMenuQuery"
                  class="w-full rounded-md border border-border bg-surface-secondary/40 px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/80 focus:outline-none focus:ring-2 focus:ring-accent/35"
                  placeholder="Search open tabs"
                  @keydown.enter.prevent="openFirstMenuMatch"
                >
                <button
                  v-if="tabsMenuQuery"
                  class="absolute inset-y-0 right-1 inline-flex items-center px-1 text-[11px] text-text-secondary hover:text-text-primary"
                  title="Clear search"
                  @click="clearTabsMenuQuery"
                >
                  ×
                </button>
              </div>
            </div>
            <div class="max-h-[280px] overflow-y-auto p-2 space-y-1">
              <div v-if="menuTabs.length === 0" class="px-2 py-3 text-xs text-text-secondary">
                {{ tabsMenuQuery ? 'No tabs match this search.' : 'No tabs in this filter.' }}
              </div>
              <div
                v-for="tab in menuTabs"
                :key="`menu-${tab.slug}`"
                class="flex items-center gap-1 rounded-md border border-border/80 bg-surface-secondary/30 px-2 py-1"
                :class="activeSlug === tab.slug ? 'border-accent/40 bg-accent/10' : ''"
              >
                <button
                  class="min-w-0 flex-1 truncate text-left text-xs"
                  :class="activeSlug === tab.slug ? 'text-accent font-medium' : 'text-text-primary'"
                  @click="openFromMenu(tab.slug)"
                >
                  {{ tab.title }}
                </button>
                <button
                  class="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] text-text-secondary hover:text-text-primary hover:bg-black/10 transition-colors"
                  title="Close tab"
                  @click="closeFromMenu(tab.slug)"
                >
                  ×
                </button>
              </div>
            </div>
            <div
              v-if="menuHiddenCount > 0"
              class="border-t border-border px-3 py-1.5 text-[11px] text-text-secondary"
            >
              Showing first {{ menuTabs.length }} of {{ menuTotal }} matches. Refine search to narrow results.
            </div>
          </div>
        </Transition>
      </div>

      <button
        class="h-7 px-2 rounded-md border border-border/55 bg-surface-secondary/35 text-text-secondary text-xs hover:text-text-primary hover:bg-surface-secondary transition-colors"
        @click="closeAllTabs"
      >
        Close all
      </button>
    </div>
  </div>
</template>
