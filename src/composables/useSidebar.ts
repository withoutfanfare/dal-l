import { ref, reactive } from 'vue'

const collapsed = ref(false)
const expandedSections = reactive(new Set<string>())

export function useSidebar() {
  function toggleSidebar() {
    collapsed.value = !collapsed.value
  }

  function toggleSection(slug: string) {
    if (expandedSections.has(slug)) {
      expandedSections.delete(slug)
    } else {
      expandedSections.add(slug)
    }
  }

  function isSectionExpanded(slug: string): boolean {
    return expandedSections.has(slug)
  }

  function expandSection(slug: string) {
    expandedSections.add(slug)
  }

  return { collapsed, toggleSidebar, toggleSection, isSectionExpanded, expandSection }
}
