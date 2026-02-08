<script setup lang="ts">
import { watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useAI } from '@/composables/useAI'
import AskInput from './AskInput.vue'
import AskResponse from './AskResponse.vue'

const { isOpen, question, response, loading, error, activeProvider, hasResponse, close, reset, ask } = useAI()

const inputRef = ref<InstanceType<typeof AskInput> | null>(null)

// Focus the input when the panel opens
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})

function handleSubmit(text: string) {
  ask(text)
}

function handleNewQuestion() {
  reset()
  nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleClose() {
  close()
}

function handleOverlayClick() {
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    e.preventDefault()
    close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <!-- Overlay -->
  <Transition name="overlay">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
      @click="handleOverlayClick"
    />
  </Transition>

  <!-- Panel -->
  <Transition name="panel">
    <div
      v-if="isOpen"
      class="fixed top-0 right-0 bottom-0 w-[460px] max-w-[90vw] bg-surface border-l border-border shadow-xl z-50 flex flex-col"
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
      <div class="flex-1 overflow-y-auto px-4 py-4">
        <div v-if="!hasResponse && !loading && !error" class="flex flex-col items-center justify-center h-full text-center px-4">
          <svg class="w-10 h-10 text-text-secondary/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <p class="text-sm text-text-secondary">
            Ask a question about your documentation and get AI-powered answers.
          </p>
        </div>

        <AskResponse
          v-else
          :question="question"
          :response="response"
          :loading="loading"
          :error="error"
          :provider="activeProvider"
        />
      </div>

      <!-- Input area -->
      <div class="border-t border-border px-4 py-3">
        <button
          v-if="hasResponse && !loading"
          class="w-full mb-2 text-xs text-accent hover:text-accent/80 transition-colors text-left"
          @click="handleNewQuestion"
        >
          Ask another question
        </button>
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
