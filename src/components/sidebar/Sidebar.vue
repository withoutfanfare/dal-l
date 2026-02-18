<script setup lang="ts">
import ProjectSwitcher from './ProjectSwitcher.vue'
import CollectionSwitcher from './CollectionSwitcher.vue'
import SidebarSection from './SidebarSection.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useNavigation } from '@/composables/useNavigation'
import { useCollections } from '@/composables/useCollections'

defineEmits<{
  'add-project': []
}>()

const { toggleSidebar } = useSidebar()
const { tree, loading } = useNavigation()
const { collections } = useCollections()
</script>

<template>
  <aside class="h-full bg-sidebar/80 backdrop-blur-sm border-r border-border flex flex-col pt-[52px] overflow-hidden">
    <!-- Project switcher -->
    <div class="px-3 pt-2 pb-1" style="-webkit-app-region: no-drag">
      <ProjectSwitcher @add-project="$emit('add-project')" />
    </div>

    <!-- Collection switcher (only when project has multiple collections) -->
    <div v-if="collections.length > 1" class="px-3 pb-1" style="-webkit-app-region: no-drag">
      <CollectionSwitcher />
    </div>

    <!-- Navigation tree -->
    <nav class="flex-1 overflow-y-auto px-2 py-1.5" style="-webkit-app-region: no-drag">
      <div v-if="loading" class="px-3 py-4 space-y-2.5 animate-pulse">
        <div class="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-1/2 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-5/6 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-3/5 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-4/5 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-1/2 rounded bg-stone-200 dark:bg-stone-700" />
        <div class="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-700" />
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
        class="flex items-center justify-center w-8 h-8 -m-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary/80 transition-colors"
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
