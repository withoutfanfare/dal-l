import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTabMenu } from './tabMenu'
import type { DocTab } from './tabState'

const tabs: DocTab[] = [
  { slug: 'ops/runbooks/deploy', title: 'Deploy Runbook', lastOpenedAt: 1700000000001, pinned: true },
  { slug: 'ops/runbooks/rollback', title: 'Rollback Procedure', lastOpenedAt: 1700000000002 },
  { slug: 'ops/playbooks/incident-response', title: 'Incident Response', lastOpenedAt: 1700000000003, pinned: true },
  { slug: 'product/analytics/funnels', title: 'Funnels Overview', lastOpenedAt: 1700000000004 },
]

test('buildTabMenu filters to pinned scope', () => {
  const result = buildTabMenu(tabs, { scope: 'pinned', query: '' })
  assert.equal(result.total, 2)
  assert.equal(result.hiddenCount, 0)
  assert.deepEqual(result.tabs.map((tab) => tab.slug), [
    'ops/runbooks/deploy',
    'ops/playbooks/incident-response',
  ])
})

test('buildTabMenu ranks exact and prefix title matches above weaker slug matches', () => {
  const result = buildTabMenu(tabs, {
    scope: 'all',
    query: 'deploy',
  })

  assert.equal(result.total, 1)
  assert.deepEqual(result.tabs.map((tab) => tab.slug), ['ops/runbooks/deploy'])
})

test('buildTabMenu supports case-insensitive query and deterministic tiebreakers', () => {
  const result = buildTabMenu(
    [
      { slug: 'docs/search/a', title: 'Search Guide', lastOpenedAt: 10 },
      { slug: 'docs/search/b', title: 'Search Guide', lastOpenedAt: 20, pinned: true },
      { slug: 'docs/search/c', title: 'Search Guide', lastOpenedAt: 15 },
    ],
    { scope: 'all', query: 'SeArCh' },
  )

  assert.deepEqual(result.tabs.map((tab) => tab.slug), [
    'docs/search/b',
    'docs/search/c',
    'docs/search/a',
  ])
})

test('buildTabMenu applies limit and reports hidden count for large sets', () => {
  const large: DocTab[] = Array.from({ length: 8 }, (_, idx) => ({
    slug: `docs/tab-${idx}`,
    title: `Tab ${idx}`,
    lastOpenedAt: idx,
  }))

  const result = buildTabMenu(large, {
    scope: 'all',
    query: '',
    limit: 3,
  })

  assert.equal(result.total, 8)
  assert.equal(result.tabs.length, 3)
  assert.equal(result.hiddenCount, 5)
})
