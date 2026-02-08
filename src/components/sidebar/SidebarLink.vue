<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { NavigationTree } from '@/composables/useNavigation'

const props = defineProps<{
  node: NavigationTree
  level: number
}>()

const route = useRoute()

const isActive = computed(() => {
  const routeSlug = route.params.slug
  if (Array.isArray(routeSlug)) {
    return routeSlug.join('/') === props.node.slug
  }
  return routeSlug === props.node.slug
})

const to = computed(() => `/${props.node.collection_id}/${props.node.slug}`)
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
    {{ props.node.title }}
  </router-link>
</template>
