import type { Router } from 'vue-router'
import { getDocument, searchDocuments } from '@/lib/api'
import type { Bookmark, SearchResult } from '@/lib/types'
import { docSlugWithoutCollection } from './deepLinks'

export interface BookmarkResolveResult {
  status: 'opened' | 'missing-anchor' | 'missing-doc' | 'error'
  nearest?: SearchResult
  message?: string
}

export async function openBookmarkTarget(
  router: Router,
  bookmark: Bookmark,
  openNearestOnMissingDoc = false,
): Promise<BookmarkResolveResult> {
  try {
    const doc = await getDocument(bookmark.docSlug)
    const slug = docSlugWithoutCollection(bookmark.collectionId, bookmark.docSlug)
    let missingAnchor = false
    if (bookmark.anchorId) {
      const id = bookmark.anchorId
      missingAnchor =
        !doc.content_html.includes(`id="${id}"`) && !doc.content_html.includes(`id='${id}'`)
    }

    await router.push({
      name: 'doc',
      params: { collection: bookmark.collectionId, slug },
      hash: bookmark.anchorId && !missingAnchor ? `#${bookmark.anchorId}` : '',
    })

    return missingAnchor ? { status: 'missing-anchor' } : { status: 'opened' }
  } catch (e) {
    const querySeed = bookmark.docSlug.split('/').pop() || bookmark.docSlug
    const nearest = await searchDocuments(querySeed, bookmark.collectionId, 1).catch(() => [])
    if (nearest.length > 0 && openNearestOnMissingDoc) {
      const best = nearest[0]
      await router.push({
        name: 'doc',
        params: {
          collection: best.collection_id,
          slug: docSlugWithoutCollection(best.collection_id, best.slug),
        },
      })
      return { status: 'missing-doc', nearest: best }
    }
    return {
      status: 'missing-doc',
      nearest: nearest[0],
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
