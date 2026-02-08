import { ref, watch } from 'vue'
import { searchDocuments } from '@/lib/api'
import type { SearchResult } from '@/lib/types'

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

function formatQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const terms = trimmed.split(/\s+/)
  const last = terms.pop()!
  terms.push(last + '*')

  return terms.join(' ')
}

function clearSearch() {
  query.value = ''
  results.value = []
  loading.value = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

watch(query, (value) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true

  debounceTimer = setTimeout(async () => {
    const thisRequest = ++requestId
    try {
      const data = await searchDocuments(formatQuery(trimmed), undefined, 20)
      if (thisRequest === requestId) {
        results.value = data
      }
    } catch {
      if (thisRequest === requestId) {
        results.value = []
      }
    } finally {
      if (thisRequest === requestId) {
        loading.value = false
      }
    }
  }, 150)
})

export function useSearch() {
  return { query, results, loading, clearSearch }
}
