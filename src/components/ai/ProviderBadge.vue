<script setup lang="ts">
import type { AiProvider } from '@/lib/types'

const props = defineProps<{
  provider: AiProvider
}>()

const providerLabels: Record<AiProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  ollama: 'Ollama',
}

const providerColours: Record<AiProvider, string> = {
  openai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  anthropic: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  gemini: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ollama: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
    :class="providerColours[props.provider]"
  >
    {{ providerLabels[props.provider] }}
  </span>
</template>
