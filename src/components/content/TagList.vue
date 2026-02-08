<script setup lang="ts">
defineProps<{
  tags: string[]
}>()
</script>

<template>
  <div v-if="tags.length > 0" class="flex flex-wrap gap-1.5 mt-3">
    <router-link
      v-for="tag in tags"
      :key="tag"
      :to="{ name: 'tag', params: { tag } }"
      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-secondary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
    >
      {{ tag }}
    </router-link>
  </div>
</template>
