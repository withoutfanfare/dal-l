import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeepLink, parseDeepLink } from './deepLinks'

test('deep link v2 round-trips through build and parse', () => {
  const built = buildDeepLink({
    projectId: 'proj-a',
    collectionId: 'ops',
    docSlug: 'runbooks/deploy',
    anchorId: 'rollback',
  })
  const parsed = parseDeepLink(built)
  assert.deepEqual(parsed, {
    projectId: 'proj-a',
    collectionId: 'ops',
    docSlug: 'runbooks/deploy',
    anchorId: 'rollback',
  })
})

test('legacy deep link still parses', () => {
  const parsed = parseDeepLink('dalil://ops/runbooks/deploy#rollback')
  assert.deepEqual(parsed, {
    collectionId: 'ops',
    docSlug: 'runbooks/deploy',
    anchorId: 'rollback',
  })
})
