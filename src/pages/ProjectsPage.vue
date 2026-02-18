<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useProjects } from '@/composables/useProjects'
import { getProjectStats, openInEditor, getPreferences, savePreferences } from '@/lib/api'
import type { ProjectStats, AppPreferences } from '@/lib/types'
import AddProjectDialog from '@/components/projects/AddProjectDialog.vue'

const { projects, activeProject, buildStatus, rebuildProject, removeProject } = useProjects()

const stats = ref<Map<string, ProjectStats>>(new Map())
const showAddDialog = ref(false)
const preferences = ref<AppPreferences>({ editorCommand: null })
const customEditor = ref('')
const removingId = ref<string | null>(null)

const EDITOR_PRESETS = [
  { label: 'VS Code', command: 'code' },
  { label: 'Cursor', command: 'cursor' },
  { label: 'Zed', command: 'zed' },
  { label: 'Sublime Text', command: 'subl' },
  { label: 'Nova', command: 'nova' },
]

const selectedPreset = computed({
  get() {
    const cmd = preferences.value.editorCommand
    if (!cmd) return ''
    const preset = EDITOR_PRESETS.find(p => p.command === cmd)
    return preset ? cmd : 'custom'
  },
  set(value: string) {
    if (value === 'custom') {
      preferences.value.editorCommand = customEditor.value || null
    } else {
      preferences.value.editorCommand = value || null
      customEditor.value = ''
    }
    savePreferences(preferences.value)
  },
})

function timeAgo(timestamp: string | undefined): string {
  if (!timestamp) return 'Never'
  const seconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)} days ago`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

async function loadStats() {
  const results = await Promise.all(
    projects.value.map(async (p) => {
      try {
        const s = await getProjectStats(p.id)
        return [p.id, s] as const
      } catch {
        return null
      }
    }),
  )
  const map = new Map<string, ProjectStats>()
  for (const r of results) {
    if (r) map.set(r[0], r[1])
  }
  stats.value = map
}

async function handleOpenFinder(path: string) {
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(path)
}

async function handleOpenEditor(path: string) {
  const cmd = preferences.value.editorCommand
  if (!cmd) return
  await openInEditor(cmd, path)
}

async function handleRebuild(id: string) {
  try {
    await rebuildProject(id)
    // Reload stats for this project after rebuild
    try {
      const s = await getProjectStats(id)
      stats.value.set(id, s)
    } catch {
      // Stats refresh is best-effort
    }
  } catch {
    // Error is tracked in buildStatus
  }
}

async function handleRemove(id: string, name: string) {
  if (!confirm(`Remove "${name}"? This will delete its database. The source folder will not be affected.`)) return
  removingId.value = id
  try {
    await removeProject(id)
    stats.value.delete(id)
  } catch {
    // Error handling
  } finally {
    removingId.value = null
  }
}

function handleCustomEditorSave() {
  if (customEditor.value.trim()) {
    preferences.value.editorCommand = customEditor.value.trim()
    savePreferences(preferences.value)
  }
}

function handleDialogClose() {
  showAddDialog.value = false
  // Reload stats to pick up the new project
  loadStats()
}

onMounted(async () => {
  preferences.value = await getPreferences()
  // Initialise custom editor field if the saved command isn't a preset
  const cmd = preferences.value.editorCommand
  if (cmd && !EDITOR_PRESETS.find(p => p.command === cmd)) {
    customEditor.value = cmd
  }
  await loadStats()
})
</script>

<template>
  <div>
    <!-- Header -->
    <header class="mb-8 flex items-start justify-between gap-4">
      <div>
        <router-link
          to="/"
          class="text-sm text-text-secondary hover:text-text-primary transition-colors mb-3 inline-block"
        >
          &larr; Back to home
        </router-link>
        <h1 class="text-3xl font-bold text-text-primary tracking-tight">Projects</h1>
        <p class="text-text-secondary mt-1">Manage your documentation projects.</p>
      </div>
      <button
        class="mt-6 px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent/90 transition-colors flex items-center gap-2 shrink-0"
        @click="showAddDialog = true"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Project
      </button>
    </header>

    <!-- Project cards -->
    <div class="space-y-4 mb-10">
      <div
        v-for="project in projects"
        :key="project.id"
        class="bg-surface rounded-xl border shadow-sm p-5 transition-shadow hover:shadow-md"
        :class="project.id === activeProject?.id
          ? 'border-accent/30 ring-2 ring-accent/15'
          : 'border-border/40'"
      >
        <!-- Title row -->
        <div class="flex items-center gap-3 mb-4">
          <span class="text-xl">{{ project.icon }}</span>
          <h2 class="text-lg font-semibold text-text-primary">{{ project.name }}</h2>
          <span
            v-if="project.id === activeProject?.id"
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent"
          >
            Active
          </span>
          <span
            v-if="project.builtIn"
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary"
          >
            Built-in
          </span>
        </div>

        <!-- Metadata -->
        <div class="space-y-2 text-sm mb-4">
          <!-- Source path (non-built-in only) -->
          <div v-if="!project.builtIn && project.sourcePath" class="flex items-center gap-2">
            <span class="text-text-secondary w-20 shrink-0">Source</span>
            <code class="text-xs font-mono text-text-primary bg-surface-secondary/60 px-2 py-0.5 rounded truncate max-w-md">
              {{ project.sourcePath }}
            </code>
            <button
              class="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors shrink-0"
              title="Open in Finder"
              @click="handleOpenFinder(project.sourcePath!)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </button>
            <button
              v-if="preferences.editorCommand"
              class="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors shrink-0"
              title="Open in editor"
              @click="handleOpenEditor(project.sourcePath!)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </button>
          </div>

          <!-- Last built -->
          <div class="flex items-center gap-2">
            <span class="text-text-secondary w-20 shrink-0">Last built</span>
            <span class="text-text-primary">{{ timeAgo(project.lastBuilt) }}</span>
          </div>

          <!-- Database size -->
          <div v-if="stats.get(project.id)" class="flex items-center gap-2">
            <span class="text-text-secondary w-20 shrink-0">Database</span>
            <span class="text-text-primary">{{ formatBytes(stats.get(project.id)!.dbSizeBytes) }}</span>
          </div>
        </div>

        <!-- Stats pills -->
        <div v-if="stats.get(project.id)" class="flex flex-wrap gap-2 mb-4">
          <span class="bg-surface-secondary rounded-full px-2.5 py-1 text-xs text-text-secondary">
            {{ stats.get(project.id)!.documentCount }} docs
          </span>
          <span class="bg-surface-secondary rounded-full px-2.5 py-1 text-xs text-text-secondary">
            {{ stats.get(project.id)!.tagCount }} tags
          </span>
          <span class="bg-surface-secondary rounded-full px-2.5 py-1 text-xs text-text-secondary">
            {{ stats.get(project.id)!.chunkCount }} chunks
          </span>
          <span class="bg-surface-secondary rounded-full px-2.5 py-1 text-xs text-text-secondary">
            {{ stats.get(project.id)!.collectionCount }} collections
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between pt-3 border-t border-border/40">
          <button
            v-if="!project.builtIn"
            :disabled="buildStatus.get(project.id) === 'building'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-text-primary border border-border hover:bg-surface-secondary transition-colors disabled:opacity-50 flex items-center gap-2"
            @click="handleRebuild(project.id)"
          >
            <svg
              v-if="buildStatus.get(project.id) === 'building'"
              class="w-3.5 h-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ buildStatus.get(project.id) === 'building' ? 'Rebuilding...' : 'Rebuild' }}
          </button>
          <div v-else />

          <button
            v-if="!project.builtIn"
            :disabled="removingId === project.id"
            class="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
            @click="handleRemove(project.id, project.name)"
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="projects.length === 0" class="py-12 text-center text-text-secondary">
        <p>No projects yet. Add a documentation folder to get started.</p>
      </div>
    </div>

    <!-- Editor Preference -->
    <div class="border-t border-border/40 pt-8 pb-4">
      <h3 class="text-sm font-semibold text-text-primary mb-1">Editor Preference</h3>
      <p class="text-xs text-text-secondary mb-4">
        Choose a text editor for opening source folders.
      </p>

      <div class="flex items-center gap-3">
        <select
          :value="selectedPreset"
          class="px-3 py-2 rounded-lg border border-border bg-surface-secondary/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors"
          @change="selectedPreset = ($event.target as HTMLSelectElement).value"
        >
          <option value="">None</option>
          <option v-for="preset in EDITOR_PRESETS" :key="preset.command" :value="preset.command">
            {{ preset.label }}
          </option>
          <option value="custom">Custom...</option>
        </select>

        <template v-if="selectedPreset === 'custom'">
          <input
            v-model="customEditor"
            type="text"
            placeholder="e.g. vim, emacs, webstorm"
            class="px-3 py-2 rounded-lg border border-border bg-surface-secondary/50 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-colors w-48"
            @keydown.enter="handleCustomEditorSave"
            @blur="handleCustomEditorSave"
          />
        </template>
      </div>
    </div>

    <!-- Add Project Dialog -->
    <AddProjectDialog v-if="showAddDialog" @close="handleDialogClose" />
  </div>
</template>
