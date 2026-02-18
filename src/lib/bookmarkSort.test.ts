import test from 'node:test'
import assert from 'node:assert/strict'
import { sortBookmarksForDisplay, type BookmarkSortLike } from './bookmarkSort'

interface FakeBookmark extends BookmarkSortLike {
  id: string
}

test('sortBookmarksForDisplay prioritises favourite, then frequency, then recency', () => {
  const items: FakeBookmark[] = [
    { id: 'recent', isFavorite: false, openCount: 1, lastOpenedAt: 200, updatedAt: 150 },
    { id: 'favorite-low', isFavorite: true, openCount: 1, lastOpenedAt: 100, updatedAt: 90 },
    { id: 'favorite-high', isFavorite: true, openCount: 5, lastOpenedAt: 80, updatedAt: 70 },
    { id: 'freq', isFavorite: false, openCount: 10, lastOpenedAt: 50, updatedAt: 40 },
  ]

  const sorted = sortBookmarksForDisplay(items)
  assert.deepEqual(sorted.map((item) => item.id), [
    'favorite-high',
    'favorite-low',
    'freq',
    'recent',
  ])
})
