import type { SearchResult } from './types'

export interface SearchUsageEntry {
  selections: number
  lastSelectedAt: number
}

export type SearchUsageMap = Record<string, SearchUsageEntry>

export interface SearchRankingSignals {
  bookmarkCountBySlug: Map<string, number>
  recentIndexBySlug: Map<string, number>
  updatedSlugs: Set<string>
  activeCollectionId?: string
  usageBySlug: SearchUsageMap
  nowMs?: number
}

const SEARCH_USAGE_STORAGE_KEY = 'dalil:search-usage:v1'

export function loadSearchUsage(): SearchUsageMap {
  try {
    const raw = window.localStorage.getItem(SEARCH_USAGE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as SearchUsageMap
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

export function saveSearchUsage(usage: SearchUsageMap) {
  try {
    window.localStorage.setItem(SEARCH_USAGE_STORAGE_KEY, JSON.stringify(usage))
  } catch {
    // Non-critical when storage is unavailable.
  }
}

export function updateSearchUsage(
  usage: SearchUsageMap,
  docSlug: string,
  nowMs: number = Date.now(),
): SearchUsageMap {
  const current = usage[docSlug] ?? { selections: 0, lastSelectedAt: nowMs }
  return {
    ...usage,
    [docSlug]: {
      selections: current.selections + 1,
      lastSelectedAt: nowMs,
    },
  }
}

function normalisedSlugTail(slug: string): string {
  return (slug.split('/').filter(Boolean).pop() ?? slug)
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
}

function usageSignal(entry: SearchUsageEntry | undefined, nowMs: number): number {
  if (!entry) return 0
  const ageHours = Math.max(0, (nowMs - entry.lastSelectedAt) / (1000 * 60 * 60))
  const frequencyBoost = Math.min(180, entry.selections * 12)
  const recencyBoost = Math.max(0, 56 - (ageHours * 1.6))
  return frequencyBoost + recencyBoost
}

function scoreSearchResult(
  result: SearchResult,
  queryLower: string,
  baselineIndex: number,
  signals: SearchRankingSignals,
): number {
  const nowMs = signals.nowMs ?? Date.now()
  let score = -baselineIndex

  const bookmarkCount = signals.bookmarkCountBySlug.get(result.slug) ?? 0
  if (bookmarkCount > 0) {
    score += 170 + Math.min(70, bookmarkCount * 12)
  }

  const recentIndex = signals.recentIndexBySlug.get(result.slug)
  if (recentIndex !== undefined) {
    score += Math.max(0, 130 - (recentIndex * 16))
  }

  if (signals.activeCollectionId && result.collection_id === signals.activeCollectionId) {
    score += 30
  }

  if (signals.updatedSlugs.has(result.slug)) {
    score += 16
  }

  score += usageSignal(signals.usageBySlug[result.slug], nowMs)

  const title = result.title.toLowerCase()
  const section = (result.section ?? '').toLowerCase()
  const slug = result.slug.toLowerCase()
  const slugTail = normalisedSlugTail(result.slug)

  if (title === queryLower) score += 230
  else if (title.startsWith(queryLower)) score += 120
  else if (title.includes(queryLower)) score += 60

  if (slugTail === queryLower || slug.endsWith(`/${queryLower}`)) {
    score += 150
  } else if (slugTail.startsWith(queryLower)) {
    score += 84
  } else if (slugTail.includes(queryLower)) {
    score += 42
  }

  if (section.includes(queryLower)) {
    score += 24
  }

  const terms = queryLower.split(/\s+/).filter(Boolean)
  if (terms.length > 1) {
    for (const term of terms) {
      if (title.includes(term)) score += 10
      if (section.includes(term)) score += 4
      if (slug.includes(term)) score += 6
    }
  }

  return score
}

export function sortSearchResults(
  results: SearchResult[],
  queryLower: string,
  signals: SearchRankingSignals,
): SearchResult[] {
  return [...results]
    .map((item, index) => ({
      item,
      score: scoreSearchResult(item, queryLower, index, signals),
      baselineIndex: index,
    }))
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score
      return a.baselineIndex - b.baselineIndex
    })
    .map((entry) => entry.item)
}
