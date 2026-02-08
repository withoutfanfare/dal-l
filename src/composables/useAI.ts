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
const unlistenFns = ref<(() => void)[]>([])

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

    // Cancel any previous listeners before registering new ones
    unlistenFns.value.forEach(fn => fn())
    unlistenFns.value = []

    question.value = text.trim()
    response.value = ''
    loading.value = true
    error.value = null
    activeProvider.value = provider ?? null

    // Register all listeners concurrently before sending the question
    const [unlistenChunk, unlistenDone, unlistenError] = await Promise.all([
      listen<string>('ai-response-chunk', (event) => {
        response.value += event.payload
      }),
      listen('ai-response-done', () => {
        loading.value = false
        cleanup()
      }),
      listen<string>('ai-response-error', (event) => {
        error.value = event.payload
        loading.value = false
        cleanup()
      }),
    ])

    unlistenFns.value = [unlistenChunk, unlistenDone, unlistenError]

    function cleanup() {
      unlistenChunk()
      unlistenDone()
      unlistenError()
      unlistenFns.value = []
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
