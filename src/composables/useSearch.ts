import { ref, watch } from 'vue'
import { searchDocuments } from '@/lib/api'
import type { SearchResult } from '@/lib/types'
import { useBookmarks } from './useBookmarks'
import { useDocActivity } from './useDocActivity'
import { useCollections } from './useCollections'
import {
  loadSearchUsage,
  saveSearchUsage,
  sortSearchResults,
  updateSearchUsage,
} from '@/lib/searchRanking'

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const collectionFilter = ref<string | undefined>(undefined)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0
const { byDocSlug } = useBookmarks()
const { recentDocuments, updatedSlugs } = useDocActivity()
const { activeCollectionId } = useCollections()
const usageBySlug = ref(loadSearchUsage())

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
  error.value = null
  collectionFilter.value = undefined
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function recordSelection(result: SearchResult) {
  usageBySlug.value = updateSearchUsage(usageBySlug.value, result.slug)
  saveSearchUsage(usageBySlug.value)
}

function performSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const trimmed = query.value.trim()
  if (!trimmed) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  debounceTimer = setTimeout(async () => {
    const thisRequest = ++requestId
    try {
      const data = await searchDocuments(formatQuery(trimmed), collectionFilter.value, 20)
      if (thisRequest === requestId) {
        const queryLower = trimmed.toLowerCase()
        const bookmarkCountBySlug = new Map<string, number>()
        for (const [slug, list] of byDocSlug.value.entries()) {
          bookmarkCountBySlug.set(slug, list.length)
        }
        const recentIndexBySlug = new Map<string, number>()
        recentDocuments.value.forEach((item, index) => {
          recentIndexBySlug.set(item.docSlug, index)
        })
        results.value = sortSearchResults(data, queryLower, {
          bookmarkCountBySlug,
          recentIndexBySlug,
          updatedSlugs: updatedSlugs.value,
          activeCollectionId: activeCollectionId.value || undefined,
          usageBySlug: usageBySlug.value,
        })
        error.value = null
      }
    } catch (e) {
      if (thisRequest === requestId) {
        results.value = []
        error.value = e instanceof Error ? e.message : String(e)
      }
    } finally {
      if (thisRequest === requestId) {
        loading.value = false
      }
    }
  }, 150)
}

watch(query, () => performSearch())
watch(collectionFilter, () => performSearch())

export function useSearch() {
  return { query, results, loading, error, collectionFilter, clearSearch, recordSelection }
}
