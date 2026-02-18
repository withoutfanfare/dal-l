<script setup lang="ts">
import { ref } from 'vue'
import { useProjects } from '@/composables/useProjects'

const emit = defineEmits<{
  close: []
}>()

const { addProject } = useProjects()

const name = ref('')
const icon = ref('\u{1F4C1}')
const sourcePath = ref('')
const error = ref('')
const isBuilding = ref(false)

async function selectFolder() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      title: 'Select documentation folder',
    })
    if (selected) {
      sourcePath.value = selected as string
    }
  } catch (e) {
    error.value = 'Failed to open folder picker'
  }
}

async function handleSubmit() {
  if (!name.value.trim() || !sourcePath.value) return

  error.value = ''
  isBuilding.value = true

  try {
    await addProject(name.value.trim(), icon.value || '\u{1F4C1}', sourcePath.value)
    emit('close')
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    isBuilding.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <div class="fixed inset-0 z-[100] flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

      <!-- Dialog card -->
      <div class="relative z-10 w-full max-w-md bg-surface rounded-xl shadow-2xl border border-border/40 overflow-hidden">
        <!-- Header -->
        <div class="px-6 pt-5 pb-3">
          <h2 class="text-lg font-semibold text-text-primary">Add Project</h2>
          <p class="text-sm text-text-secondary mt-0.5">
            Point to a folder containing markdown documentation.
          </p>
        </div>

        <!-- Form -->
        <div class="px-6 pb-4 space-y-4">
          <!-- Project name -->
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1" for="project-name">
              Project name
            </label>
            <input
              id="project-name"
              v-model="name"
              type="text"
              placeholder="e.g. Scooda"
              :disabled="isBuilding"
              class="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary/50 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-50 transition-colors"
            />
          </div>

          <!-- Icon -->
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1" for="project-icon">
              Icon
            </label>
            <input
              id="project-icon"
              v-model="icon"
              type="text"
              :disabled="isBuilding"
              class="w-20 px-3 py-2 rounded-lg border border-border bg-surface-secondary/50 text-sm text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent disabled:opacity-50 transition-colors"
            />
          </div>

          <!-- Folder picker -->
          <div>
            <label class="block text-sm font-medium text-text-primary mb-1">
              Documentation folder
            </label>
            <div class="flex gap-2">
              <div
                class="flex-1 px-3 py-2 rounded-lg border border-border bg-surface-secondary/50 text-sm truncate"
                :class="sourcePath ? 'text-text-primary' : 'text-text-secondary/50'"
              >
                {{ sourcePath || 'No folder selected' }}
              </div>
              <button
                :disabled="isBuilding"
                class="px-3 py-2 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50"
                @click="selectFolder"
              >
                Browse...
              </button>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
            <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-surface-secondary/30">
          <button
            :disabled="isBuilding"
            class="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            :disabled="isBuilding || !name.trim() || !sourcePath"
            class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            @click="handleSubmit"
          >
            <svg
              v-if="isBuilding"
              class="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ isBuilding ? 'Building...' : 'Add Project' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
