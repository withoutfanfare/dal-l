<script setup lang="ts">
import { useCollections } from '@/composables/useCollections'

const { collections, activeCollectionId, setActiveCollection } = useCollections()
</script>

<template>
  <div>
    <!-- Single collection: show app name -->
    <div v-if="collections.length <= 1" class="flex items-center gap-2 px-2 py-1.5 rounded-md">
      <span class="text-sm font-semibold text-text-primary tracking-tight">Dal&#x012B;l</span>
    </div>

    <!-- Multiple collections list -->
    <div v-else class="flex flex-col gap-0.5">
      <button
        v-for="collection in collections"
        :key="collection.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors"
        :class="collection.id === activeCollectionId
          ? 'bg-surface-secondary text-text-primary font-medium'
          : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'"
        @click="setActiveCollection(collection.id)"
      >
        <span v-if="collection.icon" class="text-base">{{ collection.icon }}</span>
        <span class="text-sm truncate">{{ collection.name }}</span>
      </button>
    </div>
  </div>
</template>
