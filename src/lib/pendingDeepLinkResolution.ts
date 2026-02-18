import { docSlugWithoutCollection } from './deepLinks'
import type { SearchResult } from './types'
import type { PendingDeepLinkTarget } from './pendingDeepLink'

interface ResolvedDocLike {
  collection_id: string
  slug: string
}

export interface PendingDeepLinkResolution {
  status: 'exact' | 'nearest' | 'unresolved'
  route?: {
    collection: string
    slug: string
    hash?: string
  }
  message?: string
}

export interface PendingDeepLinkResolverDeps {
  getDocument: (fullSlug: string) => Promise<ResolvedDocLike>
  searchDocuments: (
    query: string,
    collectionId?: string,
    limit?: number,
  ) => Promise<SearchResult[]>
}

export async function resolvePendingDeepLinkTarget(
  pending: PendingDeepLinkTarget,
  deps: PendingDeepLinkResolverDeps,
): Promise<PendingDeepLinkResolution> {
  const fullSlug = `${pending.collectionId}/${pending.docSlug}`

  try {
    const doc = await deps.getDocument(fullSlug)
    return {
      status: 'exact',
      route: {
        collection: doc.collection_id,
        slug: docSlugWithoutCollection(doc.collection_id, doc.slug),
        hash: pending.anchorId ? `#${pending.anchorId}` : undefined,
      },
    }
  } catch {
    // Fall through to nearest-candidate search.
  }

  const nearest = await deps.searchDocuments(pending.docSlug, pending.collectionId, 1).catch(() => [])
  if (nearest.length > 0) {
    const doc = nearest[0]
    return {
      status: 'nearest',
      route: {
        collection: doc.collection_id,
        slug: docSlugWithoutCollection(doc.collection_id, doc.slug),
      },
      message: 'Opened nearest available document for the pending deep link',
    }
  }

  return {
    status: 'unresolved',
    message: 'Could not resolve pending deep link in the active project',
  }
}
