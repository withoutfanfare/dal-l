import { ref, onMounted, onUnmounted } from 'vue'
import { checkSourceChanges, getBuildTimestamp, rebuildProject } from '@/lib/api'
import { useProjects } from './useProjects'

const changeMessage = ref<string | null>(null)
const buildTimestamp = ref<string | null>(null)
const checking = ref(false)
const rebuilding = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null

export function useSourceWatcher() {
  const { activeProjectId } = useProjects()

  async function check() {
    const projectId = activeProjectId.value
    if (!projectId) return

    checking.value = true
    try {
      const [message, timestamp] = await Promise.all([
        checkSourceChanges(projectId),
        getBuildTimestamp(projectId),
      ])
      changeMessage.value = message
      buildTimestamp.value = timestamp
    } catch {
      changeMessage.value = null
    } finally {
      checking.value = false
    }
  }

  async function triggerRebuild() {
    const projectId = activeProjectId.value
    if (!projectId) return

    rebuilding.value = true
    try {
      await rebuildProject(projectId)
      changeMessage.value = null
      buildTimestamp.value = String(Math.floor(Date.now() / 1000))
    } finally {
      rebuilding.value = false
    }
  }

  function dismiss() {
    changeMessage.value = null
  }

  function startPolling(intervalMs: number = 30000) {
    stopPolling()
    pollTimer = setInterval(() => check(), intervalMs)
  }

  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onMounted(() => {
    // Only poll in dev mode
    if (import.meta.env.DEV) {
      check()
      startPolling(30000)
    }
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    changeMessage,
    buildTimestamp,
    checking,
    rebuilding,
    check,
    triggerRebuild,
    dismiss,
    startPolling,
    stopPolling,
  }
}
