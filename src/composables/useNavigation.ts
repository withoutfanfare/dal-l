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

const tree = ref<NavigationTree[]>([])

export function useNavigation() {
  const { activeCollectionId } = useCollections()

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

  watch(activeCollectionId, (id) => {
    if (id) loadNavigation(id)
  }, { immediate: true })

  return { nodes, tree, loading, loadNavigation }
}
