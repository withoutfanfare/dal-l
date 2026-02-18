import { ref } from 'vue'
import {
  getDocNote,
  saveDocNote,
  listDocHighlights,
  addDocHighlight,
  deleteDocHighlight,
} from '@/lib/api'
import type { DocHighlight, DocNote } from '@/lib/types'

const note = ref<DocNote | null>(null)
const highlights = ref<DocHighlight[]>([])
const loading = ref(false)
const saving = ref(false)

export function useDocNotes() {
  async function load(projectId: string, docSlug: string) {
    if (!projectId || !docSlug) {
      note.value = null
      highlights.value = []
      return
    }
    loading.value = true
    try {
      const [nextNote, nextHighlights] = await Promise.all([
        getDocNote(projectId, docSlug),
        listDocHighlights(projectId, docSlug),
      ])
      note.value = nextNote
      highlights.value = nextHighlights
    } finally {
      loading.value = false
    }
  }

  async function save(projectId: string, docSlug: string, value: string) {
    saving.value = true
    try {
      note.value = await saveDocNote(projectId, docSlug, value)
      return note.value
    } finally {
      saving.value = false
    }
  }

  async function addHighlight(
    projectId: string,
    docSlug: string,
    selectedText: string,
    anchorId?: string,
    contextText?: string,
  ) {
    const created = await addDocHighlight(
      projectId,
      docSlug,
      anchorId ?? null,
      selectedText,
      contextText,
    )
    highlights.value.unshift(created)
    return created
  }

  async function removeHighlight(id: number) {
    await deleteDocHighlight(id)
    highlights.value = highlights.value.filter((item) => item.id !== id)
  }

  return {
    note,
    highlights,
    loading,
    saving,
    load,
    save,
    addHighlight,
    removeHighlight,
  }
}
