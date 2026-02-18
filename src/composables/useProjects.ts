import { ref, computed } from 'vue'
import { listProjects, getActiveProjectId, setActiveProject as setActiveProjectApi, addProject as addProjectApi, rebuildProject as rebuildProjectApi, removeProject as removeProjectApi } from '@/lib/api'
import { useCollections } from './useCollections'
import type { Project, BuildStatus } from '@/lib/types'

const projects = ref<Project[]>([])
const activeProjectId = ref<string>('')
const loaded = ref(false)
const buildStatus = ref<Map<string, BuildStatus>>(new Map())

export function useProjects() {
  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value),
  )

  async function loadProjects() {
    if (loaded.value) return
    projects.value = await listProjects()
    activeProjectId.value = await getActiveProjectId()
    loaded.value = true
  }

  async function switchProject(id: string) {
    if (id === activeProjectId.value) return
    await setActiveProjectApi(id)
    activeProjectId.value = id

    // Reload collections for the new project
    const { reload } = useCollections()
    await reload()
  }

  async function addProject(name: string, icon: string, sourcePath: string) {
    buildStatus.value.set(name, 'building')
    try {
      const project = await addProjectApi(name, icon, sourcePath)
      projects.value.push(project)
      buildStatus.value.set(project.id, 'complete')
    } catch (e) {
      buildStatus.value.set(name, 'error')
      throw e
    }
  }

  async function removeProject(id: string) {
    await removeProjectApi(id)
    projects.value = projects.value.filter(p => p.id !== id)
    buildStatus.value.delete(id)

    // If we removed the active project, switch to the first available
    if (id === activeProjectId.value && projects.value.length > 0) {
      await switchProject(projects.value[0].id)
    }
  }

  async function rebuildProject(id: string) {
    buildStatus.value.set(id, 'building')
    try {
      await rebuildProjectApi(id)
      buildStatus.value.set(id, 'complete')

      // If rebuilding the active project, reload collections
      if (id === activeProjectId.value) {
        const { reload } = useCollections()
        await reload()
      }
    } catch (e) {
      buildStatus.value.set(id, 'error')
      throw e
    }
  }

  async function reload() {
    loaded.value = false
    await loadProjects()
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    buildStatus,
    loadProjects,
    switchProject,
    addProject,
    removeProject,
    rebuildProject,
    reload,
  }
}
