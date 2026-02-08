<script setup lang="ts">
import SidebarLink from './SidebarLink.vue'
import { useSidebar } from '@/composables/useSidebar'
import type { NavigationTree } from '@/composables/useNavigation'

const props = defineProps<{
  nodes: NavigationTree[]
  level: number
}>()

const { toggleSection, isSectionExpanded } = useSidebar()
</script>

<template>
  <ul class="list-none m-0 p-0">
    <li v-for="node in props.nodes" :key="node.slug">
      <!-- Node with children (collapsible section) -->
      <template v-if="node.has_children && node.children.length > 0">
        <button
          class="flex items-center gap-1.5 w-full px-2 py-[5px] text-left text-[13px] rounded-md transition-colors hover:bg-surface-secondary/80"
          :style="{ paddingLeft: `${(props.level * 12) + 8}px` }"
          @click="toggleSection(node.slug)"
        >
          <svg
            class="w-3 h-3 text-text-secondary/60 flex-shrink-0 transition-transform duration-150"
            :class="isSectionExpanded(node.slug) ? 'rotate-90' : ''"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span class="text-text-secondary font-medium truncate">{{ node.title }}</span>
        </button>

        <!-- Children -->
        <SidebarSection
          v-show="isSectionExpanded(node.slug)"
          :nodes="node.children"
          :level="props.level + 1"
        />
      </template>

      <!-- Leaf node (link) -->
      <template v-else>
        <SidebarLink :node="node" :level="props.level" />
      </template>
    </li>
  </ul>
</template>
