<script setup lang="ts">
import { useTableOfContents } from '@/composables/useTableOfContents'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  contentKey?: string
}>()

const { headings, activeId, scrollToHeading, refresh } = useTableOfContents('.prose')

// Re-extract headings when the document changes
watch(
  () => props.contentKey,
  () => {
    refresh()
    mobileOpen.value = false
  },
)

// Mobile popover state
const mobileOpen = ref(false)
const showMobileButton = computed(() => headings.value.length >= 3)

function onMobileHeadingClick(id: string) {
  scrollToHeading(id)
  mobileOpen.value = false
}

// Close on outside click
function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.toc-mobile-popover') && !target.closest('.toc-mobile-trigger')) {
    mobileOpen.value = false
  }
}

onMounted(() => {
  window.document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  window.document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <!-- Desktop: sidebar TOC (2xl+) -->
  <nav
    v-if="headings.length > 0"
    class="hidden 2xl:block sticky top-[68px] w-56 shrink-0 max-h-[calc(100vh-84px)] overflow-y-auto"
  >
    <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
      On this page
    </p>
    <ul class="space-y-1">
      <li
        v-for="heading in headings"
        :key="heading.id"
      >
        <button
          class="block w-full text-left text-sm leading-relaxed transition-colors truncate"
          :class="[
            heading.level === 3 ? 'pl-3' : '',
            activeId === heading.id
              ? 'text-accent font-medium'
              : 'text-text-secondary hover:text-text-primary',
          ]"
          @click="scrollToHeading(heading.id)"
        >
          {{ heading.text }}
        </button>
      </li>
    </ul>
  </nav>

  <!-- Mobile: floating button + popover (below 2xl) -->
  <div
    v-if="showMobileButton"
    class="2xl:hidden fixed bottom-6 right-[4.5rem] z-40"
  >
    <Transition
      enter-active-class="duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >
      <div
        v-if="mobileOpen"
        class="toc-mobile-popover absolute bottom-12 right-0 w-64 max-h-72 overflow-y-auto rounded-xl bg-surface shadow-2xl ring-1 ring-border p-3"
      >
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
          On this page
        </p>
        <ul class="space-y-0.5">
          <li
            v-for="heading in headings"
            :key="heading.id"
          >
            <button
              class="block w-full text-left text-sm leading-relaxed transition-colors truncate rounded px-2 py-0.5 hover:bg-surface-secondary"
              :class="[
                heading.level === 3 ? 'pl-5' : '',
                activeId === heading.id
                  ? 'text-accent font-medium'
                  : 'text-text-secondary hover:text-text-primary',
              ]"
              @click="onMobileHeadingClick(heading.id)"
            >
              {{ heading.text }}
            </button>
          </li>
        </ul>
      </div>
    </Transition>

    <button
      class="toc-mobile-trigger flex items-center gap-1.5 px-3 h-9 rounded-full bg-surface shadow-lg ring-1 ring-border text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
      @click.stop="mobileOpen = !mobileOpen"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" />
      </svg>
      On this page
    </button>
  </div>
</template>
