import { ref, onMounted, onUnmounted } from 'vue'

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

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggle()
  }

  if (e.key === 'Escape' && isOpen.value) {
    e.preventDefault()
    close()
  }
}

let listenerCount = 0

export function useCommandPalette() {
  onMounted(() => {
    if (listenerCount === 0) {
      window.addEventListener('keydown', onKeydown)
    }
    listenerCount++
  })

  onUnmounted(() => {
    listenerCount--
    if (listenerCount === 0) {
      window.removeEventListener('keydown', onKeydown)
    }
  })

  return { isOpen, open, close, toggle }
}
