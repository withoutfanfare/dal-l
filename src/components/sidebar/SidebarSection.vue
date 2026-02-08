<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import SidebarLink from './SidebarLink.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useNavigation, type NavigationTree } from '@/composables/useNavigation'

const props = defineProps<{
  nodes: NavigationTree[]
  level: number
}>()

const route = useRoute()
const { toggleSection, isSectionExpanded, expandSection } = useSidebar()
const { containsSlug } = useNavigation()

const currentSlug = computed(() => {
  const s = route.params.slug
  if (!s) return ''
  return Array.isArray(s) ? s.join('/') : s
})

function isAncestorOfActive(node: NavigationTree): boolean {
  if (!currentSlug.value) return false
  return containsSlug(node, currentSlug.value)
}

// Auto-expand sections that contain the active document
watch(currentSlug, (slug) => {
  if (!slug) return
  for (const node of props.nodes) {
    if (node.has_children && node.children.length > 0 && containsSlug(node, slug)) {
      expandSection(node.slug)
    }
  }
}, { immediate: true })
</script>

<template>
  <ul class="list-none m-0 p-0">
    <li v-for="node in props.nodes" :key="node.slug">
      <!-- Node with children (collapsible section) -->
      <template v-if="node.has_children && node.children.length > 0">
        <button
          class="flex items-center gap-1.5 w-full px-2 py-[5px] text-left text-[13px] rounded-md transition-colors hover:bg-surface-secondary/80"
          :class="isAncestorOfActive(node) ? 'border-l-2 border-accent' : 'border-l-2 border-transparent'"
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
          <span
            class="font-medium truncate"
            :class="isAncestorOfActive(node) ? 'text-accent' : 'text-text-secondary'"
          >
            {{ node.title }}
          </span>
        </button>

        <!-- Children -->
        <SidebarSection
          v-if="isSectionExpanded(node.slug)"
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
