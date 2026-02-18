import test from 'node:test'
import assert from 'node:assert/strict'
import {
  type TabBucket,
  syncRouteToTabBucket,
  moveTabInBucket,
  togglePinInBucket,
  closeUnpinnedTabsInBucket,
  getAdjacentSlugInBucket,
} from './tabState'

function bucket(seed: string[], activeSlug: string | null = null): TabBucket {
  const tabs = seed.map((slug, index) => ({
    slug,
    title: slug,
    lastOpenedAt: 100 + index,
    pinned: false,
  }))
  return {
    tabs,
    activeSlug: activeSlug ?? seed[seed.length - 1] ?? null,
  }
}

test('syncRouteToTabBucket replaces active tab on normal navigation', () => {
  const state = bucket(['alpha', 'beta'], 'beta')
  syncRouteToTabBucket(state, 'gamma', 'Gamma', false, 999)
  assert.deepEqual(state.tabs.map((t) => t.slug), ['alpha', 'gamma'])
  assert.equal(state.activeSlug, 'gamma')
})

test('syncRouteToTabBucket appends tab when createNewTab=true', () => {
  const state = bucket(['alpha', 'beta'], 'beta')
  syncRouteToTabBucket(state, 'gamma', 'Gamma', true, 999)
  assert.deepEqual(state.tabs.map((t) => t.slug), ['alpha', 'beta', 'gamma'])
  assert.equal(state.activeSlug, 'gamma')
})

test('moveTabInBucket reorders tabs', () => {
  const state = bucket(['a', 'b', 'c'], 'b')
  moveTabInBucket(state, 'c', 0)
  assert.deepEqual(state.tabs.map((t) => t.slug), ['c', 'a', 'b'])
})

test('togglePinInBucket moves pinned tab ahead of unpinned tabs', () => {
  const state = bucket(['a', 'b', 'c'], 'b')
  const pinned = togglePinInBucket(state, 'c', 200)
  assert.equal(pinned, true)
  assert.equal(state.tabs[0]?.slug, 'c')
  assert.equal(state.tabs[0]?.pinned, true)
})

test('closeUnpinnedTabsInBucket keeps only pinned tabs and updates active', () => {
  const state = bucket(['a', 'b', 'c'], 'c')
  togglePinInBucket(state, 'a', 300)
  togglePinInBucket(state, 'b', 301)
  const nextActive = closeUnpinnedTabsInBucket(state)
  assert.deepEqual(state.tabs.map((t) => t.slug), ['a', 'b'])
  assert.equal(nextActive, 'b')
})

test('getAdjacentSlugInBucket returns neighbors and respects bounds', () => {
  const state = bucket(['a', 'b', 'c'], 'b')
  assert.equal(getAdjacentSlugInBucket(state, 'b', -1), 'a')
  assert.equal(getAdjacentSlugInBucket(state, 'b', 1), 'c')
  assert.equal(getAdjacentSlugInBucket(state, 'a', -1), null)
  assert.equal(getAdjacentSlugInBucket(state, 'c', 1), null)
})
