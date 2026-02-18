import { onMounted, onUnmounted } from 'vue'
import type { Router } from 'vue-router'
import { useSidebar } from './useSidebar'
import { useTheme } from './useTheme'
import { useAI } from './useAI'
import { useCollections } from './useCollections'
import { useNavigation, type NavigationTree } from './useNavigation'
import { useCommandPalette } from './useCommandPalette'
import { useSettings } from './useSettings'
import { registerKeydownHandler } from './useKeydownDispatcher'
import { isFeatureEnabled } from '@/lib/featureFlags'

export interface KeyboardShortcut {
  key: string
  meta: boolean
  shift: boolean
  description: string
  handler: () => void
}

function firstLeaf(nodes: NavigationTree[]): NavigationTree | null {
  for (const node of nodes) {
    if (node.has_children && node.children.length > 0) {
      const found = firstLeaf(node.children)
      if (found) return found
    } else {
      return node
    }
  }
  return null
}

export function useKeyboardShortcuts(router: Router) {
  const { toggleSidebar } = useSidebar()
  const { toggleTheme } = useTheme()
  const { toggle: toggleAI } = useAI()
  const { isConfigured } = useSettings()
  const { collections, setActiveCollection } = useCollections()
  const { loadNavigation, tree } = useNavigation()
  const { open: openSearch } = useCommandPalette()
  const aiPanelEnabled = isFeatureEnabled('aiPanel')

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
        if (aiPanelEnabled && isConfigured.value) toggleAI()
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

      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (e.key === '/') {
          e.preventDefault()
          openSearch()
          return true
        }
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('dalil:bookmark-current'))
          return true
        }
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('dalil:share-current'))
          return true
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('dalil:toggle-compare'))
          return true
        }
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('dalil:toggle-notes'))
          return true
        }
      }

      // Cmd+1..9 — switch collection
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key, 10) - 1
        if (index < collections.value.length) {
          e.preventDefault()
          const collection = collections.value[index]
          setActiveCollection(collection.id)
          loadNavigation(collection.id).then(() => {
            const leaf = firstLeaf(tree.value)
            if (leaf) {
              router.push(`/${collection.id}/${leaf.slug}`)
            }
          })
          return true
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('dalil:open-bookmarks-panel'))
        return true
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('dalil:open-recent-panel'))
        return true
      }

      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('dalil:tab-next'))
        return true
      }

      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('dalil:tab-prev'))
        return true
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
