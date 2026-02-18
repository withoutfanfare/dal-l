<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { NavigationTree } from '@/composables/useNavigation'
import { useDocActivity } from '@/composables/useDocActivity'

const props = defineProps<{
  node: NavigationTree
  level: number
}>()

const route = useRoute()
const { updatedSlugs } = useDocActivity()

const isActive = computed(() => {
  const routeSlug = route.params.slug
  if (Array.isArray(routeSlug)) {
    return routeSlug.join('/') === props.node.slug
  }
  return routeSlug === props.node.slug
})

const to = computed(() => `/${props.node.collection_id}/${props.node.slug}`)
const isUpdated = computed(() => updatedSlugs.value.has(props.node.slug))
</script>

<template>
  <router-link
    :to="to"
    class="flex items-center px-2 py-[5px] text-[13px] rounded-md transition-colors truncate"
    :class="isActive
      ? 'bg-accent/8 text-accent font-medium'
      : 'text-text-primary/80 hover:bg-surface-secondary/80 hover:text-text-primary'"
    :style="{ paddingLeft: `${(props.level * 12) + 20}px` }"
  >
    <span class="truncate">{{ props.node.title }}</span>
    <span
      v-if="isUpdated && !isActive"
      class="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-accent/80 flex-shrink-0"
      title="Updated since last viewed"
    />
  </router-link>
</template>
