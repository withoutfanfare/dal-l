import { ref, computed } from 'vue'
import { getSettings, saveSettings as saveSettingsApi, testProvider as testProviderApi } from '@/lib/api'
import type { Settings, AiProvider } from '@/lib/types'

const settings = ref<Settings>({
  openai_api_key: null,
  anthropic_api_key: null,
  ollama_base_url: null,
  preferred_provider: null,
  anthropic_model: null,
})

const loaded = ref(false)
const saving = ref(false)

const isConfigured = computed(() => {
  const s = settings.value
  return !!(s.openai_api_key || s.anthropic_api_key || s.ollama_base_url)
})

export function useSettings() {
  async function loadSettings() {
    try {
      settings.value = await getSettings()
      loaded.value = true
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  async function saveSettings(newSettings: Settings) {
    saving.value = true
    try {
      await saveSettingsApi(newSettings)
      // Reload to get the masked version back
      settings.value = await getSettings()
    } finally {
      saving.value = false
    }
  }

  async function testConnection(provider: AiProvider): Promise<string> {
    return testProviderApi(provider)
  }

  return { settings, loaded, saving, isConfigured, loadSettings, saveSettings, testConnection }
}
