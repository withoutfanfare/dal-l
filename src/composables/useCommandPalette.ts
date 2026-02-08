import { ref } from 'vue'
import { registerKeydownHandler } from './useKeydownDispatcher'

const isOpen = ref(false)

function open() {
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function toggle() {
  isOpen.value = !isOpen.value
}

// Module-scope registration — registered once, never removed (app-lifetime shortcut)
registerKeydownHandler(20, (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggle()
    return true
  }

  if (e.key === 'Escape' && isOpen.value) {
    e.preventDefault()
    close()
    return true
  }
})

export function useCommandPalette() {
  return { isOpen, open, close, toggle }
}
