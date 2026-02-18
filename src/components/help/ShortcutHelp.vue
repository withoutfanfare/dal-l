<script setup lang="ts">
import { ref } from 'vue'
import { registerKeydownHandler } from '@/composables/useKeydownDispatcher'
import { onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

const shortcutGroups = [
  {
    label: 'Global',
    shortcuts: [
      { keys: ['Cmd', 'K'], description: 'Open search' },
      { keys: ['Cmd', '\\'], description: 'Toggle sidebar' },
      { keys: ['Cmd', 'Shift', 'L'], description: 'Toggle dark mode' },
      { keys: ['Cmd', 'Shift', 'A'], description: 'Toggle AI panel' },
      { keys: ['Cmd', '?'], description: 'Keyboard shortcuts' },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['Cmd', '['], description: 'Navigate back' },
      { keys: ['Cmd', ']'], description: 'Navigate forward' },
    ],
  },
  {
    label: 'Document',
    shortcuts: [
      { keys: ['B'], description: 'Bookmark current page' },
      { keys: ['S'], description: 'Copy page link' },
      { keys: ['C'], description: 'Toggle compare mode' },
      { keys: ['N'], description: 'Focus notes sidebar' },
      { keys: ['/'], description: 'Focus search' },
    ],
  },
  {
    label: 'Search',
    shortcuts: [
      { keys: ['Esc'], description: 'Close search' },
      { keys: ['\u2191', '\u2193'], description: 'Navigate results' },
      { keys: ['Enter'], description: 'Open selected result' },
    ],
  },
  {
    label: 'AI',
    shortcuts: [
      { keys: ['Esc'], description: 'Close AI panel' },
    ],
  },
]

let unregister: (() => void) | null = null

onMounted(() => {
  unregister = registerKeydownHandler(5, (e) => {
    if (isOpen.value && e.key === 'Escape') {
      e.preventDefault()
      close()
      return true
    }

    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '?') {
      e.preventDefault()
      toggle()
      return true
    }
  })
})

onUnmounted(() => {
  unregister?.()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <Transition
          enter-active-class="duration-150 ease-out"
          enter-from-class="opacity-0 scale-[0.98] translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-[0.98] translate-y-1"
        >
          <div
            v-if="isOpen"
            class="mx-auto mt-[14vh] w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-2xl ring-1 ring-border"
          >
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h2 class="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h2>
              <kbd class="inline-flex rounded border border-border bg-surface-secondary px-1.5 py-0.5 text-[10px] font-mono text-text-secondary/60">
                Esc
              </kbd>
            </div>

            <!-- Shortcut groups -->
            <div class="max-h-[400px] overflow-y-auto px-5 py-4 space-y-5">
              <div v-for="group in shortcutGroups" :key="group.label">
                <h3 class="text-[11px] uppercase tracking-wider font-medium text-text-secondary mb-2">
                  {{ group.label }}
                </h3>
                <div class="space-y-1.5">
                  <div
                    v-for="shortcut in group.shortcuts"
                    :key="shortcut.description"
                    class="flex items-center justify-between py-1"
                  >
                    <span class="text-sm text-text-primary">{{ shortcut.description }}</span>
                    <div class="flex items-center gap-1">
                      <kbd
                        v-for="key in shortcut.keys"
                        :key="key"
                        class="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-border bg-surface-secondary text-[11px] font-mono font-medium text-text-secondary"
                      >
                        {{ key === 'Cmd' ? '\u2318' : key === 'Shift' ? '\u21E7' : key === 'Esc' ? 'esc' : key }}
                      </kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
