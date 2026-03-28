import { ref } from 'vue'
import { getDocumentSummary, generateDocumentSummary } from '@/lib/api'
import type { DocumentSummary, AiProvider } from '@/lib/types'

const WORD_COUNT_THRESHOLD = 1500

const summary = ref<DocumentSummary | null>(null)
const loading = ref(false)
const generating = ref(false)
const error = ref<string | null>(null)
const wordCount = ref(0)
let loadRequestId = 0

function countWords(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ')
  return text.split(/\s+/).filter((w) => w.length > 0).length
}

export function useDocSummary() {
  const isLongDocument = () => wordCount.value >= WORD_COUNT_THRESHOLD

  async function load(projectId: string, docSlug: string, contentHtml: string) {
    const thisRequest = ++loadRequestId
    summary.value = null
    error.value = null
    wordCount.value = countWords(contentHtml)

    if (!isLongDocument()) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      const cached = await getDocumentSummary(projectId, docSlug, contentHtml)
      if (thisRequest !== loadRequestId) return
      summary.value = cached
    } catch (e) {
      if (thisRequest !== loadRequestId) return
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (thisRequest === loadRequestId) {
        loading.value = false
      }
    }
  }

  async function generate(
    projectId: string,
    docSlug: string,
    docTitle: string,
    contentHtml: string,
    provider?: AiProvider,
  ) {
    generating.value = true
    error.value = null
    try {
      summary.value = await generateDocumentSummary(
        projectId,
        docSlug,
        docTitle,
        contentHtml,
        provider,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      generating.value = false
    }
  }

  function clear() {
    summary.value = null
    error.value = null
    wordCount.value = 0
  }

  return {
    summary,
    loading,
    generating,
    error,
    wordCount,
    isLongDocument,
    load,
    generate,
    clear,
  }
}
