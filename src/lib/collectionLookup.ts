import type { Collection } from './types'

export function findCollectionById(
  collections: readonly Collection[],
  collectionId: string,
): Collection | undefined {
  return collections.find(collection => collection.id === collectionId)
}
