import { visit } from 'unist-util-visit'
import path from 'path'

export interface ResolveLinksOptions {
  collectionId: string
  currentFilePath: string
  slugMap: Map<string, string>
}

export default function remarkResolveLinks(options: ResolveLinksOptions) {
  const { collectionId, currentFilePath, slugMap } = options
  const currentDir = path.dirname(currentFilePath)
  const lowerSlugMap = new Map<string, string>()
  const orderedPaths = Array.from(slugMap.keys())

  for (const filePath of orderedPaths) {
    const lower = filePath.toLowerCase()
    if (!lowerSlugMap.has(lower)) {
      const slug = slugMap.get(filePath)
      if (slug) lowerSlugMap.set(lower, slug)
    }
  }

  function resolveReadmeFallback(resolvedPath: string): string | null {
    const resolvedDirLower = path.dirname(resolvedPath).toLowerCase()

    const sibling = orderedPaths
      .filter((p) => path.dirname(p).toLowerCase() === resolvedDirLower && path.basename(p).toLowerCase() !== 'readme.md')
      .sort((a, b) => a.localeCompare(b))[0]

    if (sibling) return slugMap.get(sibling) ?? null

    const firstInCollection = orderedPaths
      .filter((p) => path.basename(p).toLowerCase() !== 'readme.md')
      .sort((a, b) => a.localeCompare(b))[0]

    return firstInCollection ? (slugMap.get(firstInCollection) ?? null) : null
  }

  return (tree: any) => {
    visit(tree, 'link', (node, index, parent) => {
      const url: string = node.url

      // Skip external URLs and anchor-only links
      if (/^(?:https?|mailto|tel):/.test(url) || url.startsWith('#')) {
        return
      }

      // Separate pathname from fragment/query before resolving
      const fragmentIndex = url.indexOf('#')
      const queryIndex = url.indexOf('?')
      let separatorIndex = -1
      if (fragmentIndex !== -1 && queryIndex !== -1) {
        separatorIndex = Math.min(fragmentIndex, queryIndex)
      } else if (fragmentIndex !== -1) {
        separatorIndex = fragmentIndex
      } else if (queryIndex !== -1) {
        separatorIndex = queryIndex
      }

      const pathname = separatorIndex === -1 ? url : url.slice(0, separatorIndex)
      const suffix = separatorIndex === -1 ? '' : url.slice(separatorIndex)

      // Resolve the relative .md path against the current file's directory
      const resolved = path.normalize(path.join(currentDir, pathname))

      const readmeTarget = path.basename(resolved).toLowerCase() === 'readme.md'

      // README links are treated as section pointers and redirected to the first
      // concrete page in the same section (or first page in collection).
      let slug: string | undefined
      if (readmeTarget) {
        slug = resolveReadmeFallback(resolved) ?? undefined
      } else {
        // Look up the resolved path in the slug map (case-sensitive, then case-insensitive).
        slug = slugMap.get(resolved)
        if (!slug) {
          slug = lowerSlugMap.get(resolved.toLowerCase())
        }
      }

      if (slug) {
        node.url = `/docs/${collectionId}/${slug}${suffix}`
      } else {
        // Convert link to plain text and warn
        console.warn(
          `[remark-resolve-links] Broken link in ${currentFilePath}: "${url}" (resolved to "${resolved}")`,
        )

        if (parent && typeof index === 'number') {
          // Replace the link node with its children (plain text)
          parent.children.splice(index, 1, ...node.children)
          return index
        }
      }
    })
  }
}
