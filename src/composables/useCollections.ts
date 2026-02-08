import { ref, computed } from 'vue'
import { getCollections } from '@/lib/api'
import type { Collection } from '@/lib/types'

const collections = ref<Collection[]>([])
const activeCollectionId = ref<string>('')
const loaded = ref(false)

export function useCollections() {
  async function loadCollections() {
    if (loaded.value) return
    collections.value = await getCollections()
    if (collections.value.length > 0 && !activeCollectionId.value) {
      activeCollectionId.value = collections.value[0].id
    }
    loaded.value = true
  }

  function setActiveCollection(id: string) {
    activeCollectionId.value = id
  }

  const activeCollection = computed(() =>
    collections.value.find(c => c.id === activeCollectionId.value),
  )

  return { collections, activeCollectionId, activeCollection, loadCollections, setActiveCollection }
}
