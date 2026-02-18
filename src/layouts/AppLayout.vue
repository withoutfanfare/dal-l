<script setup lang="ts">
import Sidebar from '@/components/sidebar/Sidebar.vue'
import TopBarBookmarks from '@/components/bookmarks/TopBarBookmarks.vue'
import TopBarNavControls from '@/components/navigation/TopBarNavControls.vue'
import TopBarDocTabs from '@/components/navigation/TopBarDocTabs.vue'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useCollections } from '@/composables/useCollections'
import { useProjects } from '@/composables/useProjects'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useLastVisited } from '@/composables/useLastVisited'
import { useAI } from '@/composables/useAI'
import { useSettings } from '@/composables/useSettings'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useDocHistory } from '@/composables/useDocHistory'
import { useDocTabs } from '@/composables/useDocTabs'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { isFeatureEnabled } from '@/lib/featureFlags'

const emit = defineEmits<{
  'open-settings': []
}>()

const { collapsed, sidebarWidth, toggleSidebar, setSidebarWidth, saveSidebarWidth } = useSidebar()
const { loadCollections } = useCollections()
const { loadProjects, activeProjectId } = useProjects()
const showAiPanel = isFeatureEnabled('aiPanel')
const bookmarksEnabled = isFeatureEnabled('bookmarks')
const { toggle: toggleAI } = useAI()
const { isConfigured } = useSettings()
const { open: openSearch } = useCommandPalette()
const { registerRouter: registerHistoryRouter } = useDocHistory()
const { registerRouter: registerTabsRouter } = useDocTabs()
const router = useRouter()
const route = useRoute()

const contentContainerClass = computed(() =>
  route.name === 'doc'
    ? 'mx-auto max-w-6xl px-6 py-10 lg:px-8'
    : 'mx-auto max-w-3xl px-10 py-10',
)

useKeyboardShortcuts(router)
useScrollMemory(router)
const { restoreIfHome } = useLastVisited(router)
registerHistoryRouter(router)
registerTabsRouter(router, () => activeProjectId.value || 'default')

const showAddProject = ref(false)

// Sidebar resize drag (throttled with rAF, persist only on mouseup)
const isResizing = ref(false)
let resizeRaf: number | null = null

function onResizeStart(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  if (!isResizing.value) return
  const x = e.clientX
  if (resizeRaf === null) {
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null
      setSidebarWidth(x)
    })
  }
}

function onResizeEnd() {
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = null
  }
  saveSidebarWidth()
  isResizing.value = false
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// Pause background blob animations when the window is hidden
function onVisibilityChange() {
  document.documentElement.classList.toggle('page-hidden', document.hidden)
}

onMounted(() => {
  loadProjects()
  loadCollections()
  restoreIfHome()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function handleOpenSettings() {
  emit('open-settings')
}
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-white focus:dark:bg-stone-800 focus:px-4 focus:py-2 focus:rounded focus:shadow-lg focus:text-stone-900 focus:dark:text-stone-100"
    >
      Skip to content
    </a>
    <!-- Top drag region / toolbar -->
    <div
      class="fixed top-0 left-0 right-0 h-[52px] z-50 flex items-center bg-surface/80 backdrop-blur-sm"
      style="-webkit-app-region: drag"
    >
      <!-- Left side: sidebar toggle when collapsed -->
      <div class="flex-1 flex items-center pl-[78px]" style="-webkit-app-region: no-drag">
        <Transition
          enter-active-class="duration-150 ease-out"
          enter-from-class="opacity-0 -translate-x-1"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="duration-100 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 -translate-x-1"
        >
          <button
            v-if="collapsed"
            class="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary/80 transition-colors"
            title="Show sidebar (Cmd+\)"
            @click="toggleSidebar"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </Transition>
      </div>

      <!-- Centre: search trigger -->
      <div class="flex-1 flex justify-center px-4" style="-webkit-app-region: no-drag">
        <button
          class="flex items-center gap-2 w-full max-w-[280px] h-7 px-2.5 rounded-lg border border-border/60 bg-surface-secondary/40 text-text-secondary text-xs hover:bg-surface-secondary/70 hover:border-border transition-colors"
          title="Search (Cmd+K)"
          @click="openSearch"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span class="flex-1 text-left opacity-50">Search...</span>
          <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 bg-surface/50 text-[10px] font-medium text-text-secondary/70">
            <span class="text-[11px]">&#8984;</span>K
          </kbd>
        </button>
      </div>

      <!-- Right side toolbar actions -->
      <div class="pr-3 flex items-center gap-1.5" style="-webkit-app-region: no-drag">
        <TopBarNavControls />
        <TopBarBookmarks v-if="bookmarksEnabled" />
        <template v-if="showAiPanel">
          <button
            class="h-7 px-2.5 rounded-md text-xs font-medium transition-colors border border-border/60 bg-surface-secondary/40 text-text-secondary hover:text-text-primary hover:bg-surface-secondary/70 hover:border-border"
            :title="isConfigured ? 'Ask AI (Cmd+Shift+A)' : 'Configure AI provider in settings'"
            :disabled="!isConfigured"
            :class="!isConfigured ? 'opacity-60 cursor-not-allowed hover:bg-surface-secondary/40 hover:border-border/60' : ''"
            @click="toggleAI"
          >
            Ask AI
          </button>
          <button
            class="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary/80 transition-colors"
            title="Settings"
            @click="handleOpenSettings"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </template>
      </div>
    </div>

    <!-- Background blobs -->
    <div class="ambient-blobs" aria-hidden="true">
      <div class="ambient-blob blob-1" />
      <div class="ambient-blob blob-2" />
      <div class="ambient-blob blob-3" />
    </div>

    <!-- Sidebar -->
    <div
      class="relative z-10 flex-shrink-0"
      :class="{ 'sidebar-transition': !isResizing }"
      :style="{ width: collapsed ? '0px' : sidebarWidth + 'px' }"
    >
      <Sidebar v-show="!collapsed" @add-project="showAddProject = true" />
    </div>

    <!-- Resize handle -->
    <div
      v-show="!collapsed"
      class="sidebar-resize-handle relative z-10"
      :class="{ 'sidebar-resize-active': isResizing }"
      @mousedown="onResizeStart"
    />

    <!-- Main content -->
    <main id="main-content" class="relative z-10 flex-1 overflow-y-auto pt-[52px]" style="contain: content">
      <TopBarDocTabs />
      <div :class="contentContainerClass">
        <router-view />
      </div>
    </main>

    <!-- Add project dialog -->
    <AddProjectDialog v-if="showAddProject" @close="showAddProject = false" />
  </div>
</template>
