import { ref } from 'vue'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const updateAvailable = ref(false)
const updateVersion = ref('')
const updating = ref(false)
const error = ref<string | null>(null)

export function useUpdater() {
  async function checkForUpdate() {
    try {
      const update = await check()
      if (update) {
        updateAvailable.value = true
        updateVersion.value = update.version
      }
    } catch (e) {
      // Silently fail — update check is non-critical
      console.warn('Update check failed:', e)
    }
  }

  async function installUpdate() {
    try {
      updating.value = true
      error.value = null
      const update = await check()
      if (update) {
        await update.downloadAndInstall()
        await relaunch()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Update failed'
    } finally {
      updating.value = false
    }
  }

  function dismissUpdate() {
    updateAvailable.value = false
  }

  return {
    updateAvailable,
    updateVersion,
    updating,
    error,
    checkForUpdate,
    installUpdate,
    dismissUpdate,
  }
}
