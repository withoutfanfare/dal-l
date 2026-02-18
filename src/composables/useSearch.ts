import { ref, watch } from 'vue'
import { searchDocuments } from '@/lib/api'
import type { SearchResult } from '@/lib/types'
import { useBookmarks } from './useBookmarks'
import { useDocActivity } from './useDocActivity'
import { useCollections } from './useCollections'

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

function normalisedSlugTail(slug: string): string {
  return (slug.split('/').filter(Boolean).pop() ?? slug)
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
}

function relevanceScore(result: SearchResult, queryLower: string, baselineIndex: number): number {
  let score = -baselineIndex

  const bookmarkCount = byDocSlug.value.get(result.slug)?.length ?? 0
  if (bookmarkCount > 0) {
    score += 180 + Math.min(60, bookmarkCount * 10)
  }

  const recentIndex = recentDocuments.value.findIndex((item) => item.docSlug === result.slug)
  if (recentIndex >= 0) {
    score += Math.max(0, 140 - (recentIndex * 18))
  }

  if (activeCollectionId.value && result.collection_id === activeCollectionId.value) {
    score += 32
  }

  if (updatedSlugs.value.has(result.slug)) {
    score += 18
  }

  const title = result.title.toLowerCase()
  if (title === queryLower) score += 180
  else if (title.startsWith(queryLower)) score += 95
  else if (title.includes(queryLower)) score += 50

  const section = (result.section ?? '').toLowerCase()
  if (section.includes(queryLower)) score += 22

  if (normalisedSlugTail(result.slug).includes(queryLower)) {
    score += 36
  }

  return score
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
        results.value = [...data]
          .map((item, index) => ({
            item,
            score: relevanceScore(item, queryLower, index),
            baselineIndex: index,
          }))
          .sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score
            return a.baselineIndex - b.baselineIndex
          })
          .map((entry) => entry.item)
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
  return { query, results, loading, error, collectionFilter, clearSearch }
}
