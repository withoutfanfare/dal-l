import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePendingDeepLinkTarget } from './pendingDeepLinkResolution'
import type { PendingDeepLinkTarget } from './pendingDeepLink'
import type { SearchResult } from './types'

const pending: PendingDeepLinkTarget = {
  projectId: 'project-a',
  collectionId: 'ops',
  docSlug: 'runbooks/deploy',
  anchorId: 'rollback',
  createdAt: 1_700_000_000_000,
}

test('resolvePendingDeepLinkTarget returns exact route when document exists', async () => {
  const resolution = await resolvePendingDeepLinkTarget(pending, {
    getDocument: async () => ({
      collection_id: 'ops',
      slug: 'ops/runbooks/deploy',
    }),
    searchDocuments: async () => [],
  })

  assert.equal(resolution.status, 'exact')
  assert.deepEqual(resolution.route, {
    collection: 'ops',
    slug: 'runbooks/deploy',
    hash: '#rollback',
  })
})

test('resolvePendingDeepLinkTarget falls back to nearest document', async () => {
  const nearest: SearchResult[] = [
    {
      slug: 'ops/runbooks/deployment-overview',
      title: 'Deployment Overview',
      section: 'Runbooks',
      collection_id: 'ops',
      snippet: '',
    },
  ]
  const resolution = await resolvePendingDeepLinkTarget(pending, {
    getDocument: async () => {
      throw new Error('missing')
    },
    searchDocuments: async () => nearest,
  })

  assert.equal(resolution.status, 'nearest')
  assert.deepEqual(resolution.route, {
    collection: 'ops',
    slug: 'runbooks/deployment-overview',
  })
  assert.match(resolution.message ?? '', /nearest available document/i)
})

test('resolvePendingDeepLinkTarget returns unresolved when no candidates found', async () => {
  const resolution = await resolvePendingDeepLinkTarget(pending, {
    getDocument: async () => {
      throw new Error('missing')
    },
    searchDocuments: async () => [],
  })

  assert.equal(resolution.status, 'unresolved')
  assert.equal(resolution.route, undefined)
  assert.match(resolution.message ?? '', /could not resolve/i)
})
