<script setup lang="ts">
import CollectionSwitcher from './CollectionSwitcher.vue'
import SidebarSection from './SidebarSection.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useNavigation } from '@/composables/useNavigation'

const { toggleSidebar } = useSidebar()
const { tree, loading } = useNavigation()
</script>

<template>
  <aside class="h-full bg-sidebar/80 backdrop-blur-sm border-r border-border flex flex-col pt-[52px] overflow-hidden">
    <!-- Collection switcher -->
    <div class="px-3 pt-2 pb-1" style="-webkit-app-region: no-drag">
      <CollectionSwitcher />
    </div>

    <!-- Navigation tree -->
    <nav class="flex-1 overflow-y-auto px-2 py-1.5" style="-webkit-app-region: no-drag">
      <div v-if="loading" class="px-3 py-8 text-text-secondary text-xs text-center">
        Loading...
      </div>
      <SidebarSection v-else :nodes="tree" :level="0" />
    </nav>

    <!-- Footer -->
    <div
      class="flex items-center justify-between px-3 py-2.5 border-t border-border"
      style="-webkit-app-region: no-drag"
    >
      <ThemeToggle />
      <button
        class="flex items-center justify-center w-6 h-6 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary/80 transition-colors"
        title="Collapse sidebar (Cmd+\)"
        @click="toggleSidebar"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
        </svg>
      </button>
    </div>
  </aside>
</template>
