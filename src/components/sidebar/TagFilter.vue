<script setup lang="ts">
import { useTags } from '@/composables/useTags'
import { useCollections } from '@/composables/useCollections'
import { watch } from 'vue'

const { tags, loading, loadTags } = useTags()
const { activeCollectionId } = useCollections()

// Reload tags when collection changes
watch(
  activeCollectionId,
  (id) => {
    if (id) {
      loadTags(id)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!loading && tags.length > 0" class="px-3 py-2">
    <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
      Tags
    </p>
    <div class="flex flex-wrap gap-1">
      <router-link
        v-for="tag in tags"
        :key="tag.tag"
        :to="{ name: 'tag', params: { tag: tag.tag } }"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-surface-secondary text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
      >
        {{ tag.tag }}
        <span class="text-text-secondary/60">{{ tag.count }}</span>
      </router-link>
    </div>
  </div>
</template>
