import assert from 'node:assert/strict'
import test from 'node:test'
import type { Collection } from './types.ts'
import { findCollectionById } from './collectionLookup.ts'

const collections: Collection[] = [
  {
    id: 'guides',
    name: 'Guides',
    icon: 'G',
    description: null,
    sort_order: 0,
  },
  {
    id: 'reference',
    name: 'Reference',
    icon: 'R',
    description: null,
    sort_order: 1,
  },
]

test('finds the collection named by a document instead of relying on active state', () => {
  assert.equal(findCollectionById(collections, 'reference'), collections[1])
})

test('returns undefined when the document collection is unavailable', () => {
  assert.equal(findCollectionById(collections, 'missing'), undefined)
})
