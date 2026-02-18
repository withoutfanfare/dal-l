<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import CommandPalette from '@/components/search/CommandPalette.vue'
import AskPanel from '@/components/ai/AskPanel.vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import Toast from '@/components/ui/Toast.vue'
import ShortcutHelp from '@/components/help/ShortcutHelp.vue'
import { useSettings } from '@/composables/useSettings'
import { useUpdater } from '@/composables/useUpdater'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { useToast } from '@/composables/useToast'

const settingsOpen = ref(false)
const showAiPanel = isFeatureEnabled('aiPanel')
const { loadSettings } = useSettings()
const { checkForUpdate } = useUpdater()
const { addToast } = useToast()

function openSettings() {
  settingsOpen.value = true
}

function handleDeepLinkStatus(event: Event) {
  const customEvent = event as CustomEvent<{ message?: string }>
  const message = customEvent.detail?.message
  if (message) addToast(message, 'info')
}

onMounted(() => {
  if (showAiPanel) {
    loadSettings()
  }
  checkForUpdate()
  window.addEventListener('dalil:deeplink-status', handleDeepLinkStatus)
})

onUnmounted(() => {
  window.removeEventListener('dalil:deeplink-status', handleDeepLinkStatus)
})
</script>

<template>
  <AppLayout @open-settings="openSettings" />
  <CommandPalette />
  <AskPanel v-if="showAiPanel" />
  <SettingsModal v-if="showAiPanel" :open="settingsOpen" @close="settingsOpen = false" />
  <UpdateNotification />
  <ShortcutHelp />
  <Toast />
</template>
