<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { registerKeydownHandler } from '@/composables/useKeydownDispatcher'
import { useFocusTrap } from '@/composables/useFocusTrap'

defineProps<{
  src: string
  alt: string
}>()

const emit = defineEmits<{
  close: []
}>()

let unregister: (() => void) | null = null
const dialogRef = ref<HTMLElement | null>(null)
const isActive = ref(true)

useFocusTrap(dialogRef, isActive)

onMounted(async () => {
  unregister = registerKeydownHandler(30, (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      emit('close')
      return true
    }
  })

  await nextTick()
  dialogRef.value?.querySelector<HTMLButtonElement>('button')?.focus()
})

onUnmounted(() => {
  unregister?.()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        ref="dialogRef"
        class="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Image preview"
        @click.self="emit('close')"
      >
        <!-- Close button -->
        <button
          class="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          aria-label="Close image preview"
          @click="emit('close')"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Image -->
        <img
          :src="src"
          :alt="alt"
          class="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        >
      </div>
    </Transition>
  </Teleport>
</template>
