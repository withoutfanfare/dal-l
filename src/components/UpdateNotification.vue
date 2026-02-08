<script setup lang="ts">
import { useUpdater } from '@/composables/useUpdater'

const { updateAvailable, updateVersion, updating, installUpdate, dismissUpdate } = useUpdater()
</script>

<template>
  <Transition
    enter-active-class="duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="updateAvailable"
      class="fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-lg bg-surface-secondary px-4 py-3 shadow-lg ring-1 ring-border"
    >
      <div class="text-sm">
        <p class="font-medium text-text-primary">Update available</p>
        <p class="text-text-secondary">Version {{ updateVersion }} is ready to install.</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          :disabled="updating"
          class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          @click="installUpdate"
        >
          {{ updating ? 'Installing...' : 'Update' }}
        </button>
        <button
          :disabled="updating"
          class="rounded-md px-2 py-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          @click="dismissUpdate"
        >
          Later
        </button>
      </div>
    </div>
  </Transition>
</template>
