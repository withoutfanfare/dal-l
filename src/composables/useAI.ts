import { ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { askQuestion } from '@/lib/api'
import { useSettings } from './useSettings'
import type { AiProvider } from '@/lib/types'

const isOpen = ref(false)
const question = ref('')
const response = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const activeProvider = ref<AiProvider | null>(null)

export function useAI() {
  const { isConfigured } = useSettings()

  const hasResponse = computed(() => response.value.length > 0)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function reset() {
    question.value = ''
    response.value = ''
    loading.value = false
    error.value = null
    activeProvider.value = null
  }

  async function ask(text: string, provider?: AiProvider) {
    if (!text.trim()) return

    question.value = text.trim()
    response.value = ''
    loading.value = true
    error.value = null
    activeProvider.value = provider ?? null

    // Set up event listeners before sending the question
    const unlistenChunk = await listen<string>('ai-response-chunk', (event) => {
      response.value += event.payload
    })

    const unlistenDone = await listen('ai-response-done', () => {
      loading.value = false
      cleanup()
    })

    const unlistenError = await listen<string>('ai-response-error', (event) => {
      error.value = event.payload
      loading.value = false
      cleanup()
    })

    function cleanup() {
      unlistenChunk()
      unlistenDone()
      unlistenError()
    }

    try {
      await askQuestion(text.trim(), provider)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      loading.value = false
      cleanup()
    }
  }

  return {
    isOpen,
    question,
    response,
    loading,
    error,
    activeProvider,
    hasResponse,
    isConfigured,
    open,
    close,
    toggle,
    reset,
    ask,
  }
}
