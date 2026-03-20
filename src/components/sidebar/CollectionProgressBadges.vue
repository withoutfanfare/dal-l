<script setup lang="ts">
import { watch } from 'vue'
import { useCollectionProgress } from '@/composables/useCollectionProgress'
import { useProjects } from '@/composables/useProjects'
import { useCollections } from '@/composables/useCollections'

const { activeProjectId } = useProjects()
const { collections } = useCollections()
const { progressByCollection, load } = useCollectionProgress()

watch(
  () => activeProjectId.value,
  (projectId) => {
    if (projectId) load(projectId)
  },
  { immediate: true },
)

function progressLabel(collectionId: string): string | null {
  const progress = progressByCollection.value.get(collectionId)
  if (!progress || progress.totalDocuments === 0) return null
  return `${progress.viewedDocuments}/${progress.totalDocuments}`
}

function progressPercent(collectionId: string): number {
  const progress = progressByCollection.value.get(collectionId)
  if (!progress || progress.totalDocuments === 0) return 0
  return Math.round((progress.viewedDocuments / progress.totalDocuments) * 100)
}
</script>

<template>
  <div
    v-if="collections.length > 0 && progressByCollection.size > 0"
    class="px-3 pb-1.5"
    style="-webkit-app-region: no-drag"
  >
    <div class="flex flex-wrap gap-1.5">
      <div
        v-for="col in collections"
        :key="col.id"
        class="inline-flex items-center gap-1 rounded-md border border-border/50 bg-surface-secondary/25 px-1.5 py-0.5"
      >
        <span class="text-[10px] text-text-secondary truncate max-w-[80px]">{{ col.name }}</span>
        <span
          v-if="progressLabel(col.id)"
          class="text-[10px] font-medium tabular-nums"
          :class="progressPercent(col.id) >= 100 ? 'text-emerald-500' : 'text-text-secondary'"
        >
          {{ progressLabel(col.id) }}
        </span>
      </div>
    </div>
  </div>
</template>
