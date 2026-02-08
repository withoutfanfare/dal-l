<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { registerKeydownHandler } from '@/composables/useKeydownDispatcher'
import ProviderConfig from './ProviderConfig.vue'
import type { AiProvider, Settings } from '@/lib/types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { settings, saving, loadSettings, saveSettings, testConnection } = useSettings()

// Local draft state for editing
const draft = ref<Settings>({
  openai_api_key: null,
  anthropic_api_key: null,
  ollama_base_url: null,
  preferred_provider: null,
  anthropic_model: null,
})

const openaiRef = ref<InstanceType<typeof ProviderConfig> | null>(null)
const anthropicRef = ref<InstanceType<typeof ProviderConfig> | null>(null)
const ollamaRef = ref<InstanceType<typeof ProviderConfig> | null>(null)

// Sync draft when settings load or modal opens
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await loadSettings()
    syncDraft()
  }
})

function syncDraft() {
  draft.value = { ...settings.value }
}

async function handleSave() {
  await saveSettings(draft.value)
  emit('close')
}

function handleCancel() {
  syncDraft()
  emit('close')
}

async function handleTestProvider(provider: AiProvider) {
  const refMap: Record<AiProvider, typeof openaiRef> = {
    openai: openaiRef,
    anthropic: anthropicRef,
    ollama: ollamaRef,
  }

  const configRef = refMap[provider].value
  if (!configRef) return

  // Note: directly accessing child refs for testing state — acceptable for tightly coupled parent-child
  configRef.testResult = null

  try {
    const message = await testConnection(provider)
    configRef.testResult = { success: true, message }
  } catch (e) {
    configRef.testResult = { success: false, message: e instanceof Error ? e.message : String(e) }
  } finally {
    configRef.testing = false
  }
}

let unregister: (() => void) | null = null

onMounted(() => {
  unregister = registerKeydownHandler(30, (e) => {
    if (e.key === 'Escape' && props.open) {
      e.preventDefault()
      handleCancel()
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
  <Transition name="modal-overlay">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/30 dark:bg-black/50 z-50"
      @click="handleCancel"
    />
  </Transition>

  <!-- Modal -->
  <Transition name="modal">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="-webkit-app-region: no-drag"
    >
      <div
        class="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
        @click.stop
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 class="text-base font-semibold text-text-primary">Settings</h2>
          <button
            class="text-text-secondary hover:text-text-primary transition-colors"
            @click="handleCancel"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="px-5 py-4 space-y-5">
          <p class="text-xs text-text-secondary">
            Configure AI providers to enable the Ask AI feature. At least one provider must be configured.
          </p>

          <!-- OpenAI -->
          <ProviderConfig
            ref="openaiRef"
            provider="openai"
            label="OpenAI"
            :value="draft.openai_api_key ?? ''"
            placeholder="sk-..."
            note="Uses GPT-4o for chat and text-embedding-3-small for search."
            @update:value="draft.openai_api_key = $event || null"
            @test="handleTestProvider('openai')"
          />

          <!-- Anthropic -->
          <ProviderConfig
            ref="anthropicRef"
            provider="anthropic"
            label="Anthropic"
            :value="draft.anthropic_api_key ?? ''"
            placeholder="sk-ant-..."
            note="Uses Claude for chat. Requires OpenAI or Ollama for embeddings."
            @update:value="draft.anthropic_api_key = $event || null"
            @test="handleTestProvider('anthropic')"
          />

          <!-- Ollama -->
          <ProviderConfig
            ref="ollamaRef"
            provider="ollama"
            label="Ollama"
            :value="draft.ollama_base_url ?? 'http://localhost:11434'"
            placeholder="http://localhost:11434"
            note="Runs locally. No API key needed. Ensure Ollama is running."
            is-url
            @update:value="draft.ollama_base_url = $event || null"
            @test="handleTestProvider('ollama')"
          />

          <!-- Preferred provider -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-text-primary">Preferred Provider</label>
            <select
              :value="draft.preferred_provider ?? ''"
              class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              @change="draft.preferred_provider = ($event.target as HTMLSelectElement).value || null"
            >
              <option value="">Auto-detect</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
            </select>
            <p class="text-xs text-text-secondary">
              When set to auto-detect, the first configured provider will be used.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            class="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
            @click="handleCancel"
          >
            Cancel
          </button>
          <button
            :disabled="saving"
            class="rounded-lg bg-accent px-4 py-2 text-sm text-white font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="handleSave"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 200ms ease;
}
.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: all 200ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
