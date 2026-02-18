import test from 'node:test'
import assert from 'node:assert/strict'
import { sortSearchResults, type SearchUsageMap } from './searchRanking'
import type { SearchResult } from './types'

function result(
  slug: string,
  title: string,
  section: string,
  collection_id: string = 'docs',
): SearchResult {
  return {
    slug,
    title,
    section,
    collection_id,
    snippet: '',
  }
}

test('sortSearchResults boosts exact title match above baseline rank', () => {
  const input = [
    result('docs/alpha', 'Something Else', 'overview'),
    result('docs/incident-response', 'Incident Response', 'playbook'),
  ]

  const sorted = sortSearchResults(input, 'incident response', {
    bookmarkCountBySlug: new Map(),
    recentIndexBySlug: new Map(),
    updatedSlugs: new Set(),
    activeCollectionId: 'docs',
    usageBySlug: {},
    nowMs: 1_700_000_000_000,
  })

  assert.equal(sorted[0]?.slug, 'docs/incident-response')
})

test('sortSearchResults uses usage telemetry to promote repeatedly selected docs', () => {
  const input = [
    result('docs/cache-guide', 'Cache Guide', 'performance'),
    result('docs/cache-playbook', 'Cache Playbook', 'performance'),
  ]

  const usage: SearchUsageMap = {
    'docs/cache-playbook': {
      selections: 8,
      lastSelectedAt: 1_700_000_000_000,
    },
  }

  const sorted = sortSearchResults(input, 'cache', {
    bookmarkCountBySlug: new Map(),
    recentIndexBySlug: new Map(),
    updatedSlugs: new Set(),
    activeCollectionId: 'docs',
    usageBySlug: usage,
    nowMs: 1_700_000_000_000,
  })

  assert.equal(sorted[0]?.slug, 'docs/cache-playbook')
})

test('sortSearchResults balances bookmark/recent/active-collection signals', () => {
  const input = [
    result('ops/rotation', 'On-call Rotation', 'team', 'ops'),
    result('docs/rotation-policy', 'Rotation Policy', 'governance', 'docs'),
  ]

  const sorted = sortSearchResults(input, 'rotation', {
    bookmarkCountBySlug: new Map([['ops/rotation', 1]]),
    recentIndexBySlug: new Map([['ops/rotation', 0]]),
    updatedSlugs: new Set(['ops/rotation']),
    activeCollectionId: 'ops',
    usageBySlug: {},
    nowMs: 1_700_000_000_000,
  })

  assert.equal(sorted[0]?.slug, 'ops/rotation')
})
