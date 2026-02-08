import { ref, watch } from 'vue'
import { getNavigation } from '@/lib/api'
import type { NavigationNode } from '@/lib/types'
import { useCollections } from './useCollections'

export interface NavigationTree extends NavigationNode {
  children: NavigationTree[]
}

const cache = new Map<string, NavigationNode[]>()
const nodes = ref<NavigationNode[]>([])
const loading = ref(false)
const tree = ref<NavigationTree[]>([])

function buildTree(flat: NavigationNode[]): NavigationTree[] {
  const slugMap = new Map<string, NavigationTree>()

  for (const node of flat) {
    slugMap.set(node.slug, { ...node, children: [] })
  }

  const roots: NavigationTree[] = []

  for (const node of flat) {
    const treeNode = slugMap.get(node.slug)!
    if (node.parent_slug && slugMap.has(node.parent_slug)) {
      slugMap.get(node.parent_slug)!.children.push(treeNode)
    } else {
      roots.push(treeNode)
    }
  }

  return roots
}

async function loadNavigation(collectionId: string) {
  if (!collectionId) return

  if (cache.has(collectionId)) {
    nodes.value = cache.get(collectionId)!
    tree.value = buildTree(nodes.value)
    return
  }

  loading.value = true
  try {
    const result = await getNavigation(collectionId)
    cache.set(collectionId, result)
    nodes.value = result
    tree.value = buildTree(result)
  } finally {
    loading.value = false
  }
}

// Module-scope watcher — registered once regardless of how many times useNavigation() is called
const { activeCollectionId } = useCollections()
watch(activeCollectionId, (id) => {
  if (id) loadNavigation(id)
}, { immediate: true })

function clearCache() {
  cache.clear()
}

/**
 * Find the root section node that matches a section title.
 * Returns the slug of the first top-level node whose title matches.
 */
function findSectionSlug(sectionTitle: string): string | null {
  for (const node of tree.value) {
    if (node.title === sectionTitle) {
      return node.slug
    }
  }
  return null
}

/**
 * Check whether a given slug exists somewhere under a navigation node.
 */
function containsSlug(node: NavigationTree, slug: string): boolean {
  if (node.slug === slug) return true
  for (const child of node.children) {
    if (containsSlug(child, slug)) return true
  }
  return false
}

/**
 * Find the ancestry chain of slugs from root to the given slug.
 * Returns an array of ancestor slugs (excluding the slug itself).
 */
function getAncestorSlugs(slug: string): string[] {
  const ancestors: string[] = []

  function walk(nodes: NavigationTree[], chain: string[]): boolean {
    for (const node of nodes) {
      if (node.slug === slug) {
        ancestors.push(...chain)
        return true
      }
      if (node.has_children && node.children.length > 0) {
        if (walk(node.children, [...chain, node.slug])) return true
      }
    }
    return false
  }

  walk(tree.value, [])
  return ancestors
}

export function useNavigation() {
  return { nodes, tree, loading, loadNavigation, clearCache, findSectionSlug, containsSlug, getAncestorSlugs }
}
