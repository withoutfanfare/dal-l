<script setup lang="ts">
import Sidebar from '@/components/sidebar/Sidebar.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useCollections } from '@/composables/useCollections'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useScrollMemory } from '@/composables/useScrollMemory'
import { useLastVisited } from '@/composables/useLastVisited'
// HIDDEN: AI — import { useAI } from '@/composables/useAI'
// HIDDEN: AI — import { useSettings } from '@/composables/useSettings'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

// HIDDEN: AI
// const emit = defineEmits<{
//   'open-settings': []
// }>()

const { collapsed, sidebarWidth, toggleSidebar, setSidebarWidth, saveSidebarWidth } = useSidebar()
const { loadCollections } = useCollections()
// HIDDEN: AI — const { toggle: toggleAI } = useAI()
// HIDDEN: AI — const { isConfigured } = useSettings()
const { open: openSearch } = useCommandPalette()
const router = useRouter()

useKeyboardShortcuts(router)
useScrollMemory(router)
const { restoreIfHome } = useLastVisited(router)

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
  loadCollections()
  restoreIfHome()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
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

      <!-- HIDDEN: AI — Right side toolbar actions (Ask AI + Settings) removed -->
      <div class="pr-3" style="-webkit-app-region: no-drag" />
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
      <Sidebar v-show="!collapsed" />
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
      <div class="mx-auto max-w-3xl px-10 py-10">
        <router-view />
      </div>
    </main>
  </div>
</template>
