<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled: boolean
}>()

const emit = defineEmits<{
  submit: [text: string]
}>()

const input = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  const text = input.value.trim()
  if (!text || props.disabled) return
  emit('submit', text)
  input.value = ''
}

function focus() {
  textareaRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="flex gap-2 items-end">
    <textarea
      ref="textareaRef"
      v-model="input"
      :disabled="disabled"
      rows="2"
      class="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      placeholder="Ask a question about your documentation..."
      @keydown="handleKeydown"
    />
    <button
      :disabled="disabled || !input.trim()"
      class="flex-shrink-0 rounded-lg bg-accent px-3 py-2 text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      @click="submit"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    </button>
  </div>
</template>
