import { ref, watch, type Ref } from 'vue'

export function useKeyboardNavigation(
  itemCount: Ref<number>,
  onSelect: (index: number) => void,
) {
  const selectedIndex = ref(0)

  watch(itemCount, () => {
    selectedIndex.value = 0
  })

  function onKeydown(e: KeyboardEvent) {
    const count = itemCount.value
    if (count === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % count
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex.value = (selectedIndex.value - 1 + count) % count
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onSelect(selectedIndex.value)
    }
  }

  return { selectedIndex, onKeydown }
}
