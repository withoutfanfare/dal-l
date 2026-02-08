<script setup lang="ts">
import { watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useAI } from '@/composables/useAI'
import { registerKeydownHandler } from '@/composables/useKeydownDispatcher'
import { useFocusTrap } from '@/composables/useFocusTrap'
import AskInput from './AskInput.vue'
import AskResponse from './AskResponse.vue'

const { isOpen, conversations, loading, hasConversations, close, clearConversation, ask } = useAI()

const inputRef = ref<InstanceType<typeof AskInput> | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

useFocusTrap(panelRef, isOpen)

// Focus the input when the panel opens
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})

// Auto-scroll to bottom when new content arrives
watch(
  () => conversations.value.length > 0
    ? conversations.value[conversations.value.length - 1].response
    : null,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  },
)

// Scroll to bottom when a new conversation entry is added
watch(
  () => conversations.value.length,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
    }
  },
)

function handleSubmit(text: string) {
  ask(text)
}

function handleClose() {
  close()
}

function handleOverlayClick() {
  close()
}

function handleClear() {
  clearConversation()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

let unregister: (() => void) | null = null

onMounted(() => {
  unregister = registerKeydownHandler(20, (e) => {
    if (e.key === 'Escape' && isOpen.value) {
      e.preventDefault()
      close()
      return true
    }
  })
})

onUnmounted(() => {
  unregister?.()
})
</script>

<template>
  <!-- Overlay -->
  <Transition name="overlay">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/20 dark:bg-black/40 z-[100]"
      @click="handleOverlayClick"
    />
  </Transition>

  <!-- Panel -->
  <Transition name="panel">
    <div
      v-if="isOpen"
      ref="panelRef"
      class="fixed top-0 right-0 bottom-0 w-[460px] max-w-[90vw] bg-surface border-l border-border shadow-xl z-[110] flex flex-col"
      style="-webkit-app-region: no-drag"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border pt-[52px]">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <h2 class="text-sm font-semibold text-text-primary">Ask AI</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="hasConversations"
            class="text-xs text-text-secondary hover:text-text-primary transition-colors"
            @click="handleClear"
          >
            Clear
          </button>
          <span class="text-[10px] text-text-secondary bg-surface-secondary rounded px-1.5 py-0.5 font-mono">
            Esc
          </span>
          <button
            class="text-text-secondary hover:text-text-primary transition-colors"
            @click="handleClose"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div ref="scrollRef" class="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-atomic="false">
        <div v-if="!hasConversations" class="flex flex-col items-center justify-center h-full text-center px-4">
          <svg class="w-10 h-10 text-text-secondary/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <p class="text-sm text-text-secondary">
            Ask a question about your documentation and get AI-powered answers.
          </p>
        </div>

        <div v-else class="space-y-6">
          <AskResponse
            v-for="entry in conversations"
            :key="entry.id"
            :question="entry.question"
            :response="entry.response"
            :loading="entry.loading"
            :error="entry.error"
            :provider="entry.provider"
          />
        </div>
      </div>

      <!-- Input area -->
      <div class="border-t border-border px-4 py-3">
        <AskInput
          ref="inputRef"
          :disabled="loading"
          @submit="handleSubmit"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 200ms ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.panel-enter-active,
.panel-leave-active {
  transition: transform 250ms ease;
}
.panel-enter-from,
.panel-leave-to {
  transform: translateX(100%);
}
</style>
