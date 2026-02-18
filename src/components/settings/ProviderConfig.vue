<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AiProvider } from '@/lib/types'

const props = defineProps<{
  provider: AiProvider
  label: string
  value: string
  placeholder: string
  note?: string
  isUrl?: boolean
  helpUrl?: string
}>()

const emit = defineEmits<{
  'update:value': [val: string]
  test: []
}>()

const showKey = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

const validationError = computed(() => {
  const val = props.value.trim()
  if (!val) return null

  if (props.provider === 'openai') {
    if (!val.startsWith('sk-') && !isMasked(val)) {
      return 'OpenAI API key must start with "sk-"'
    }
  }

  if (props.provider === 'anthropic') {
    if (!val.startsWith('sk-ant-') && !isMasked(val)) {
      return 'Anthropic API key must start with "sk-ant-"'
    }
  }

  if (props.provider === 'gemini') {
    if (!val.startsWith('AIza') && !isMasked(val)) {
      return 'Gemini API key usually starts with "AIza"'
    }
  }

  if (props.isUrl) {
    try {
      const url = new URL(val)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'URL must start with http:// or https://'
      }
    } catch {
      return 'Please enter a valid URL'
    }
  }

  return null
})

const isValid = computed(() => validationError.value === null)

function isMasked(val: string): boolean {
  if (val.length > 0 && [...val].every(c => c === '*')) return true
  const dotPos = val.indexOf('...')
  if (dotPos > 0 && dotPos + 3 < val.length) return true
  return false
}

async function handleTest() {
  testing.value = true
  emit('test')
}

// Expose testing state and validation so the parent can access them
defineExpose({ testing, testResult, isValid })
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <label class="block text-sm font-medium text-text-primary">{{ label }}</label>
      <a
        v-if="helpUrl"
        :href="helpUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-accent hover:text-accent/80 transition-colors"
      >
        Get API key
      </a>
    </div>

    <div class="flex gap-2">
      <div class="relative flex-1">
        <input
          :type="isUrl || showKey ? 'text' : 'password'"
          :value="value"
          :placeholder="placeholder"
          class="w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 pr-10"
          :class="validationError
            ? 'border-red-400 dark:border-red-600 focus:border-red-400 focus:ring-red-400'
            : 'border-border focus:border-accent focus:ring-accent'"
          @input="emit('update:value', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="!isUrl"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
          @click="showKey = !showKey"
        >
          <!-- Eye / Eye-off icon -->
          <svg v-if="showKey" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      <button
        :disabled="testing"
        class="flex-shrink-0 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-border disabled:opacity-50"
        @click="handleTest"
      >
        {{ testing ? 'Testing...' : 'Test' }}
      </button>
    </div>

    <p v-if="validationError" class="text-xs text-red-600 dark:text-red-400">{{ validationError }}</p>
    <p v-else-if="note" class="text-xs text-text-secondary">{{ note }}</p>

    <!-- Test result -->
    <div v-if="testResult" class="text-xs rounded px-2 py-1" :class="testResult.success ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'">
      {{ testResult.message }}
    </div>
  </div>
</template>
