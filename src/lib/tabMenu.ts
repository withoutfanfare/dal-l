import type { DocTab } from './tabState'

export type TabMenuScope = 'all' | 'pinned'

export interface BuildTabMenuOptions {
  scope: TabMenuScope
  query: string
  limit?: number
}

export interface BuildTabMenuResult {
  tabs: DocTab[]
  total: number
  hiddenCount: number
}

const DEFAULT_LIMIT = 120

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

function scoreTab(tab: DocTab, query: string): number {
  const title = normalise(tab.title)
  const slug = normalise(tab.slug)

  if (title === query) return 500
  if (title.startsWith(query)) return 400
  if (title.includes(query)) return 300
  if (slug.startsWith(query)) return 220
  if (slug.includes(query)) return 160
  return -1
}

export function buildTabMenu(
  tabs: DocTab[],
  options: BuildTabMenuOptions,
): BuildTabMenuResult {
  const scoped = options.scope === 'pinned' ? tabs.filter((tab) => tab.pinned) : tabs.slice()
  const query = normalise(options.query)
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT)

  if (!query) {
    const clipped = scoped.slice(0, limit)
    return {
      tabs: clipped,
      total: scoped.length,
      hiddenCount: Math.max(0, scoped.length - clipped.length),
    }
  }

  const ranked = scoped
    .map((tab, index) => ({ tab, index, score: scoreTab(tab, query) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aPinned = a.tab.pinned ? 1 : 0
      const bPinned = b.tab.pinned ? 1 : 0
      if (bPinned !== aPinned) return bPinned - aPinned
      if (b.tab.lastOpenedAt !== a.tab.lastOpenedAt) return b.tab.lastOpenedAt - a.tab.lastOpenedAt
      return a.index - b.index
    })

  const clipped = ranked.slice(0, limit).map((item) => item.tab)
  return {
    tabs: clipped,
    total: ranked.length,
    hiddenCount: Math.max(0, ranked.length - clipped.length),
  }
}
