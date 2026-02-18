import { ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { askQuestion, cancelAiRequest } from '@/lib/api'
import { useSettings } from './useSettings'
import type { AiProvider } from '@/lib/types'

export interface AiSourceReference {
  chunkId: number
  documentId: number
  docSlug: string
  docTitle: string
  headingContext: string
  excerpt: string
}

export interface ConversationEntry {
  id: string
  question: string
  response: string
  loading: boolean
  error: string | null
  provider: AiProvider | null
  timestamp: number
  sources: AiSourceReference[]
}

interface AiResponseChunkEvent {
  requestId: string
  content: string
}

interface AiResponseDoneEvent {
  requestId: string
  cancelled: boolean
}

interface AiResponseErrorEvent {
  requestId: string
  message: string
}

interface AiResponseSourcesEvent {
  requestId: string
  sources: AiSourceReference[]
}

const isOpen = ref(false)
const conversations = ref<ConversationEntry[]>([])
const listenersReady = ref(false)
const unlistenFns = ref<(() => void)[]>([])
const entryByRequest = new Map<string, ConversationEntry>()

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function ensureListeners() {
  if (listenersReady.value) return

  const [unlistenChunk, unlistenDone, unlistenError, unlistenSources] = await Promise.all([
    listen<AiResponseChunkEvent>('ai-response-chunk', (event) => {
      const entry = entryByRequest.get(event.payload.requestId)
      if (!entry) return
      entry.response += event.payload.content
    }),
    listen<AiResponseDoneEvent>('ai-response-done', (event) => {
      const entry = entryByRequest.get(event.payload.requestId)
      if (!entry) return
      entry.loading = false
      if (event.payload.cancelled && !entry.error) {
        entry.error = 'Cancelled'
      }
      entryByRequest.delete(event.payload.requestId)
    }),
    listen<AiResponseErrorEvent>('ai-response-error', (event) => {
      const entry = entryByRequest.get(event.payload.requestId)
      if (!entry) return
      entry.error = event.payload.message
      entry.loading = false
      entryByRequest.delete(event.payload.requestId)
    }),
    listen<AiResponseSourcesEvent>('ai-response-sources', (event) => {
      const entry = entryByRequest.get(event.payload.requestId)
      if (!entry) return
      entry.sources = event.payload.sources ?? []
    }),
  ])

  unlistenFns.value = [unlistenChunk, unlistenDone, unlistenError, unlistenSources]
  listenersReady.value = true
}

export function useAI() {
  const { isConfigured } = useSettings()

  const hasConversations = computed(() => conversations.value.length > 0)
  const currentEntry = computed(() =>
    conversations.value.length > 0
      ? conversations.value[conversations.value.length - 1]
      : null,
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
    entryByRequest.clear()
  }

  async function ask(text: string, provider?: AiProvider) {
    if (!text.trim()) return

    await ensureListeners()

    const entry: ConversationEntry = {
      id: createRequestId(),
      question: text.trim(),
      response: '',
      loading: true,
      error: null,
      provider: provider ?? null,
      timestamp: Date.now(),
      sources: [],
    }

    conversations.value.push(entry)
    entryByRequest.set(entry.id, entry)

    try {
      await askQuestion(text.trim(), entry.id, provider)
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e)
      entry.loading = false
      entryByRequest.delete(entry.id)
    }
  }

  async function cancelCurrent() {
    const entry = currentEntry.value
    if (!entry || !entry.loading) return
    try {
      await cancelAiRequest(entry.id)
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e)
      entry.loading = false
      entryByRequest.delete(entry.id)
    }
  }

  function disposeListeners() {
    unlistenFns.value.forEach((fn) => fn())
    unlistenFns.value = []
    listenersReady.value = false
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
    cancelCurrent,
    disposeListeners,
  }
}
