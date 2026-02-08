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

      // Look up the resolved path in the slug map
      const slug = slugMap.get(resolved)

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
