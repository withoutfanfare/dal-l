import { onMounted, onUnmounted } from 'vue'
import type { Router } from 'vue-router'
import { useSidebar } from './useSidebar'
import { useTheme } from './useTheme'
import { useAI } from './useAI'
import { registerKeydownHandler } from './useKeydownDispatcher'

export interface KeyboardShortcut {
  key: string
  meta: boolean
  shift: boolean
  description: string
  handler: () => void
}

export function useKeyboardShortcuts(router: Router) {
  const { toggleSidebar } = useSidebar()
  const { toggleTheme } = useTheme()
  const { toggle: toggleAI, isConfigured } = useAI()

  const shortcuts: KeyboardShortcut[] = [
    {
      key: '\\',
      meta: true,
      shift: false,
      description: 'Toggle sidebar',
      handler: () => toggleSidebar(),
    },
    {
      key: 'L',
      meta: true,
      shift: true,
      description: 'Toggle dark mode',
      handler: () => toggleTheme(),
    },
    {
      key: '[',
      meta: true,
      shift: false,
      description: 'Navigate back',
      handler: () => router.back(),
    },
    {
      key: ']',
      meta: true,
      shift: false,
      description: 'Navigate forward',
      handler: () => router.forward(),
    },
    {
      key: 'A',
      meta: true,
      shift: true,
      description: 'Toggle Ask AI panel',
      handler: () => {
        if (isConfigured.value) toggleAI()
      },
    },
  ]

  let unregister: (() => void) | null = null

  onMounted(() => {
    unregister = registerKeydownHandler(10, (e) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey)
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const keyMatch = e.key === shortcut.key

        if (metaMatch && shiftMatch && keyMatch) {
          e.preventDefault()
          shortcut.handler()
          return true
        }
      }
    })
  })

  onUnmounted(() => {
    unregister?.()
  })

  return { shortcuts }
}
