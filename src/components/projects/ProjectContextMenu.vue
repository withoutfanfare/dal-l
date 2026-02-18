<script setup lang="ts">
import { useProjects } from '@/composables/useProjects'

const props = defineProps<{
  projectId: string
  projectName: string
  builtIn: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { rebuildProject, removeProject, buildStatus } = useProjects()

const isRebuilding = buildStatus.value.get(props.projectId) === 'building'

async function handleRebuild() {
  emit('close')
  await rebuildProject(props.projectId)
}

async function handleRemove() {
  if (confirm(`Remove "${props.projectName}"? This will delete the project database.`)) {
    emit('close')
    await removeProject(props.projectId)
  }
}
</script>

<template>
  <div class="py-1 bg-surface rounded-lg shadow-lg border border-border/60 min-w-[160px]">
    <button
      class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
      :disabled="isRebuilding"
      @click="handleRebuild"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
      </svg>
      <span>{{ isRebuilding ? 'Rebuilding...' : 'Rebuild' }}</span>
    </button>

    <template v-if="!builtIn">
      <div class="my-1 border-t border-border/60" />
      <button
        class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        @click="handleRemove"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
        <span>Remove</span>
      </button>
    </template>
  </div>
</template>
