import { ref, computed } from 'vue'
import { listen } from '@tauri-apps/api/event'
import {
  askQuestion,
  cancelAiRequest,
  getAiConversationHistory,
  saveAiConversationMessage,
  clearAiConversationHistory,
} from '@/lib/api'
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
const activeDocSlug = ref<string | null>(null)
const activeProjectId = ref<string | null>(null)
const hasPersistedHistory = ref(false)

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** Persist a completed conversation entry to the database. */
async function persistEntry(entry: ConversationEntry) {
  const projectId = activeProjectId.value
  const docSlug = activeDocSlug.value
  if (!projectId || !docSlug || entry.loading) return

  try {
    await saveAiConversationMessage(projectId, docSlug, 'user', entry.question)
    const sourcesJson = entry.sources.length > 0 ? JSON.stringify(entry.sources) : null
    await saveAiConversationMessage(projectId, docSlug, 'assistant', entry.response, sourcesJson)
  } catch {
    // Non-critical — history persistence failure should not disrupt the user.
  }
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
      // Persist completed entry
      if (!entry.error) {
        persistEntry(entry)
      }
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
    // Also clear persisted history
    const projectId = activeProjectId.value
    const docSlug = activeDocSlug.value
    if (projectId && docSlug) {
      clearAiConversationHistory(projectId, docSlug).catch(() => {})
    }
    hasPersistedHistory.value = false
  }

  function startNewConversation() {
    conversations.value = []
    entryByRequest.clear()
    hasPersistedHistory.value = false
  }

  /** Load persisted conversation history for the given document. */
  async function loadHistory(projectId: string, docSlug: string) {
    activeProjectId.value = projectId
    activeDocSlug.value = docSlug

    try {
      const messages = await getAiConversationHistory(projectId, docSlug, 20)
      if (messages.length === 0) {
        hasPersistedHistory.value = false
        return
      }

      hasPersistedHistory.value = true

      // Only load if current conversations are empty (don't overwrite active session)
      if (conversations.value.length > 0) return

      // Reconstruct conversation entries from persisted message pairs
      const entries: ConversationEntry[] = []
      for (let i = 0; i < messages.length; i += 2) {
        const userMsg = messages[i]
        const assistantMsg = messages[i + 1]
        if (!userMsg || userMsg.role !== 'user') continue

        const sources: AiSourceReference[] = []
        if (assistantMsg?.sourcesJson) {
          try {
            const parsed = JSON.parse(assistantMsg.sourcesJson)
            if (Array.isArray(parsed)) sources.push(...parsed)
          } catch { /* ignore parse errors */ }
        }

        entries.push({
          id: createRequestId(),
          question: userMsg.content,
          response: assistantMsg?.content ?? '',
          loading: false,
          error: null,
          provider: null,
          timestamp: userMsg.createdAt * 1000,
          sources,
        })
      }

      if (entries.length > 0) {
        conversations.value = entries
      }
    } catch {
      // Non-critical
      hasPersistedHistory.value = false
    }
  }

  /** Update the active document context without loading history. */
  function setDocContext(projectId: string, docSlug: string) {
    activeProjectId.value = projectId
    activeDocSlug.value = docSlug
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
    hasPersistedHistory,
    currentEntry,
    isConfigured,
    open,
    close,
    toggle,
    clearConversation,
    startNewConversation,
    loadHistory,
    setDocContext,
    ask,
    cancelCurrent,
    disposeListeners,
  }
}
