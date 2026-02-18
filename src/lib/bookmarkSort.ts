export interface BookmarkSortLike {
  isFavorite: boolean
  openCount: number
  lastOpenedAt: number | null
  updatedAt: number
}

export function sortBookmarksForDisplay<T extends BookmarkSortLike>(bookmarks: T[]): T[] {
  return [...bookmarks].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
    if (a.openCount !== b.openCount) return b.openCount - a.openCount
    const aScore = a.lastOpenedAt ?? a.updatedAt
    const bScore = b.lastOpenedAt ?? b.updatedAt
    return bScore - aScore
  })
}
