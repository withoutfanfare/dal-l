<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjects } from '@/composables/useProjects'
import { useCollections } from '@/composables/useCollections'
import { useDocTabs } from '@/composables/useDocTabs'

const route = useRoute()
const router = useRouter()
const { activeProjectId } = useProjects()
const { activeCollectionId } = useCollections()
const { getTabs, getActiveSlug, closeTab, setActiveTab, clearCollectionTabs } = useDocTabs()

const projectKey = computed(() => activeProjectId.value || 'default')

const currentCollectionId = computed(() => {
  const routeCollection = route.params.collection
  const routeValue = Array.isArray(routeCollection) ? routeCollection[0] : routeCollection
  return routeValue || activeCollectionId.value || ''
})

const routeSlug = computed(() => {
  const raw = route.params.slug
  if (!raw) return ''
  const slug = Array.isArray(raw) ? raw.join('/') : raw
  return slug || ''
})

const tabs = computed(() => {
  if (!currentCollectionId.value) return []
  return getTabs(projectKey.value, currentCollectionId.value)
})

const activeSlug = computed(() => {
  if (!currentCollectionId.value) return null
  return routeSlug.value || getActiveSlug(projectKey.value, currentCollectionId.value)
})

const showTabs = computed(() =>
  route.name === 'doc' && tabs.value.length > 0,
)

function openTab(slug: string) {
  if (!currentCollectionId.value) return
  setActiveTab(projectKey.value, currentCollectionId.value, slug)
  router.push({
    name: 'doc',
    params: {
      collection: currentCollectionId.value,
      slug,
    },
  }).catch(() => {})
}

function closeSingleTab(slug: string) {
  if (!currentCollectionId.value) return

  const wasActive = activeSlug.value === slug
  const nextSlug = closeTab(projectKey.value, currentCollectionId.value, slug)

  if (wasActive) {
    if (nextSlug) {
      router.push({
        name: 'doc',
        params: {
          collection: currentCollectionId.value,
          slug: nextSlug,
        },
      }).catch(() => {})
    } else {
      router.push(`/${currentCollectionId.value}`).catch(() => {})
    }
  }
}

function closeAllTabs() {
  if (!currentCollectionId.value) return
  clearCollectionTabs(projectKey.value, currentCollectionId.value)
  router.push(`/${currentCollectionId.value}`).catch(() => {})
}
</script>

<template>
  <div
    v-if="showTabs"
    class="sticky top-0 z-30 h-[34px] border-b border-border bg-surface/90 backdrop-blur"
    style="-webkit-app-region: no-drag"
  >
    <div class="h-full flex items-center gap-1 px-2">
      <div class="min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <div class="inline-flex items-center gap-1 pr-2">
          <button
            v-for="tab in tabs"
            :key="tab.slug"
            class="inline-flex items-center gap-1.5 rounded-md px-2 h-7 text-xs border transition-colors max-w-[240px]"
            :class="activeSlug === tab.slug
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border bg-surface-secondary/40 text-text-secondary hover:text-text-primary hover:bg-surface-secondary'"
            @click="openTab(tab.slug)"
          >
            <span class="truncate">{{ tab.title }}</span>
            <span
              class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] hover:bg-black/10"
              @click.stop="closeSingleTab(tab.slug)"
            >
              ×
            </span>
          </button>
        </div>
      </div>

      <button
        class="h-7 px-2 rounded-md border border-border bg-surface-secondary/40 text-text-secondary text-xs hover:text-text-primary hover:bg-surface-secondary transition-colors"
        @click="closeAllTabs"
      >
        Close all
      </button>
    </div>
  </div>
</template>
