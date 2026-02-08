import { ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { askQuestion } from '@/lib/api'
import { useSettings } from './useSettings'
import type { AiProvider } from '@/lib/types'

export interface ConversationEntry {
  id: string
  question: string
  response: string
  loading: boolean
  error: string | null
  provider: AiProvider | null
  timestamp: number
}

const isOpen = ref(false)
const conversations = ref<ConversationEntry[]>([])
const unlistenFns = ref<(() => void)[]>([])

export function useAI() {
  const { isConfigured } = useSettings()

  const hasConversations = computed(() => conversations.value.length > 0)
  const currentEntry = computed(() =>
    conversations.value.length > 0
      ? conversations.value[conversations.value.length - 1]
      : null
  )
  const loading = computed(() => currentEntry.value?.loading ?? false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function clearConversation() {
    conversations.value = []
  }

  async function ask(text: string, provider?: AiProvider) {
    if (!text.trim()) return

    // Cancel any previous listeners before registering new ones
    unlistenFns.value.forEach(fn => fn())
    unlistenFns.value = []

    const entry: ConversationEntry = {
      id: crypto.randomUUID(),
      question: text.trim(),
      response: '',
      loading: true,
      error: null,
      provider: provider ?? null,
      timestamp: Date.now(),
    }

    conversations.value.push(entry)

    // Register all listeners concurrently before sending the question
    const [unlistenChunk, unlistenDone, unlistenError] = await Promise.all([
      listen<string>('ai-response-chunk', (event) => {
        entry.response += event.payload
      }),
      listen('ai-response-done', () => {
        entry.loading = false
        cleanup()
      }),
      listen<string>('ai-response-error', (event) => {
        entry.error = event.payload
        entry.loading = false
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
      entry.error = e instanceof Error ? e.message : String(e)
      entry.loading = false
      cleanup()
    }
  }

  return {
    isOpen,
    conversations,
    loading,
    hasConversations,
    currentEntry,
    isConfigured,
    open,
    close,
    toggle,
    clearConversation,
    ask,
  }
}
