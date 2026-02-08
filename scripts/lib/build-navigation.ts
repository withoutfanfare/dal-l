import { toSlug } from './slug.js'

export interface DocInfo {
  slug: string
  title: string
  section: string
  sortOrder: number
  parentSlug: string
  level: number
}

export interface NavigationNode {
  slug: string
  parentSlug: string
  title: string
  sortOrder: number
  level: number
  hasChildren: boolean
}

/**
 * Build a navigation tree from processed document metadata for a single collection.
 *
 * Creates section nodes for top-level directories (even when no corresponding
 * document exists), determines parent relationships, and marks nodes that
 * contain children.
 */
export function buildNavigation(documents: DocInfo[]): NavigationNode[] {
  const nodeMap = new Map<string, NavigationNode>()

  // Pass 1: discover section nodes from unique top-level directories.
  // Sections are level-0 groupings derived from the `section` field.
  for (const doc of documents) {
    if (!doc.section) continue

    const sectionSlug = toSlug(doc.section, false)

    if (!nodeMap.has(sectionSlug)) {
      nodeMap.set(sectionSlug, {
        slug: sectionSlug,
        parentSlug: '',
        title: doc.section,
        sortOrder: Infinity,
        level: 0,
        hasChildren: false,
      })
    }
  }

  // Pass 2: ensure intermediate parent nodes exist for deeply nested docs.
  // For a slug like "a/b/c" at level 2, the parent "a/b" at level 1 must exist.
  for (const doc of documents) {
    if (doc.level < 2) continue

    const parts = doc.parentSlug.split('/')
    for (let i = 1; i < parts.length; i++) {
      const intermediateSlug = parts.slice(0, i + 1).join('/')
      const intermediateLevel = i

      if (!nodeMap.has(intermediateSlug)) {
        const parentOfIntermediate =
          i === 1 ? parts[0] : parts.slice(0, i).join('/')
        nodeMap.set(intermediateSlug, {
          slug: intermediateSlug,
          parentSlug: parentOfIntermediate,
          title: toTitle(parts[i]),
          sortOrder: 999,
          level: intermediateLevel,
          hasChildren: false,
        })
      }
    }
  }

  // Pass 3: add document nodes, merging with existing section/intermediate nodes
  // when the slug matches (e.g. an index file whose slug equals its section slug).
  // Skip root-level documents with no section — these are collection index pages
  // (e.g. README.md) that shouldn't appear in the sidebar navigation.
  for (const doc of documents) {
    if (!doc.section && !doc.parentSlug && doc.level === 0) {
      continue
    }

    const existing = nodeMap.get(doc.slug)

    if (existing) {
      // Merge: prefer the document's title and take the lower sort order.
      // Also update parentSlug and level from the document, as the section
      // placeholder may have less accurate values.
      existing.title = doc.title
      existing.sortOrder = Math.min(existing.sortOrder, doc.sortOrder)
      existing.parentSlug = doc.parentSlug
      existing.level = doc.level
    } else {
      nodeMap.set(doc.slug, {
        slug: doc.slug,
        parentSlug: doc.parentSlug,
        title: doc.title,
        sortOrder: doc.sortOrder,
        level: doc.level,
        hasChildren: false,
      })
    }
  }

  // Pass 4: update section sort orders from their earliest child when still
  // at Infinity (no index document provided a sort order).
  for (const node of nodeMap.values()) {
    if (node.parentSlug === '') continue

    const parent = nodeMap.get(node.parentSlug)
    if (parent && parent.sortOrder === Infinity) {
      parent.sortOrder = Math.min(parent.sortOrder, node.sortOrder)
    }
  }

  // Any section that never received a real sort order gets 999.
  for (const node of nodeMap.values()) {
    if (node.sortOrder === Infinity) {
      node.sortOrder = 999
    }
  }

  // Pass 5: mark parents that have children.
  for (const node of nodeMap.values()) {
    if (node.parentSlug === '') continue

    const parent = nodeMap.get(node.parentSlug)
    if (parent) {
      parent.hasChildren = true
    }
  }

  // Sort: by level first, then by sortOrder within each parent group.
  const nodes = Array.from(nodeMap.values())
  nodes.sort((a, b) => {
    if (a.parentSlug !== b.parentSlug) {
      return a.parentSlug.localeCompare(b.parentSlug)
    }
    return a.sortOrder - b.sortOrder
  })

  return nodes
}

// toSlug is imported from ./slug.ts (shared implementation).
// Calls in this file use stripPrefix=false because section names have already
// been cleaned of numeric prefixes by extract-metadata.ts.

function toTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
