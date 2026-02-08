import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigation, type NavigationTree } from './useNavigation'

export interface SequentialDoc {
  title: string
  slug: string
  collectionId: string
}

function flattenLeaves(nodes: NavigationTree[]): SequentialDoc[] {
  const result: SequentialDoc[] = []

  for (const node of nodes) {
    if (node.has_children && node.children.length > 0) {
      result.push(...flattenLeaves(node.children))
    } else {
      result.push({
        title: node.title,
        slug: node.slug,
        collectionId: node.collection_id,
      })
    }
  }

  return result
}

export function useSequentialNavigation() {
  const route = useRoute()
  const { tree } = useNavigation()

  const orderedDocs = computed(() => flattenLeaves(tree.value))

  const currentIndex = computed(() => {
    const routeSlug = route.params.slug
    if (!routeSlug) return -1

    const slug = Array.isArray(routeSlug) ? routeSlug.join('/') : routeSlug
    return orderedDocs.value.findIndex((doc) => doc.slug === slug)
  })

  const previousDoc = computed<SequentialDoc | null>(() => {
    if (currentIndex.value <= 0) return null
    return orderedDocs.value[currentIndex.value - 1]
  })

  const nextDoc = computed<SequentialDoc | null>(() => {
    if (currentIndex.value < 0 || currentIndex.value >= orderedDocs.value.length - 1) return null
    return orderedDocs.value[currentIndex.value + 1]
  })

  return { previousDoc, nextDoc }
}
