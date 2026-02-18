<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import ProjectContextMenu from '@/components/projects/ProjectContextMenu.vue'
import type { Project } from '@/lib/types'

const emit = defineEmits<{
  'add-project': []
}>()

const { projects, activeProject, switchProject } = useProjects()
const router = useRouter()
const isOpen = ref(false)

// Context menu state
const contextMenuProject = ref<{ id: string; name: string; builtIn: boolean } | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function selectProject(id: string) {
  switchProject(id)
  router.push('/')
  isOpen.value = false
}

function handleAddProject() {
  isOpen.value = false
  emit('add-project')
}

function handleManageProjects() {
  isOpen.value = false
  router.push('/projects')
}

// Close on click outside
function onClickOutside() {
  isOpen.value = false
}

function onProjectContextMenu(event: MouseEvent, project: Project) {
  event.preventDefault()
  contextMenuProject.value = { id: project.id, name: project.name, builtIn: project.builtIn }
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
}
</script>

<template>
  <div class="relative" @click.stop>
    <!-- Trigger button -->
    <button
      class="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left transition-colors hover:bg-surface-secondary/80"
      @click="toggleDropdown"
    >
      <span v-if="activeProject?.icon" class="text-base">{{ activeProject?.icon }}</span>
      <span class="text-sm font-semibold text-text-primary tracking-tight truncate flex-1">
        {{ activeProject?.name ?? 'Select Project' }}
      </span>
      <svg
        class="w-3.5 h-3.5 text-text-secondary transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="duration-100 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="duration-75 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1 z-50 bg-surface rounded-lg shadow-lg border border-border/60 py-1 origin-top"
      >
        <!-- Project list -->
        <button
          v-for="project in projects"
          :key="project.id"
          class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm transition-colors"
          :class="project.id === activeProject?.id
            ? 'bg-surface-secondary text-text-primary font-medium'
            : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'"
          @click="selectProject(project.id)"
          @contextmenu="onProjectContextMenu($event, project)"
        >
          <span v-if="project.icon" class="text-base">{{ project.icon }}</span>
          <span class="truncate">{{ project.name }}</span>
          <!-- Checkmark for active -->
          <svg
            v-if="project.id === activeProject?.id"
            class="w-3.5 h-3.5 ml-auto text-accent flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>

        <!-- Divider -->
        <div class="my-1 border-t border-border/60" />

        <!-- Manage projects action -->
        <button
          class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
          @click="handleManageProjects"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Manage Projects...</span>
        </button>

        <!-- Divider -->
        <div class="my-1 border-t border-border/60" />

        <!-- Add project action -->
        <button
          class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors"
          @click="handleAddProject"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Project...</span>
        </button>
      </div>
    </Transition>

    <!-- Click-outside overlay -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="onClickOutside" />

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="contextMenuProject"
        class="fixed z-[100]"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <ProjectContextMenu
          :project-id="contextMenuProject.id"
          :project-name="contextMenuProject.name"
          :built-in="contextMenuProject.builtIn"
          @close="contextMenuProject = null"
        />
      </div>
      <div v-if="contextMenuProject" class="fixed inset-0 z-[99]" @click="contextMenuProject = null" />
    </Teleport>
  </div>
</template>
