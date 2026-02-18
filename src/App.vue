<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import CommandPalette from '@/components/search/CommandPalette.vue'
// HIDDEN: AI — import AskPanel from '@/components/ai/AskPanel.vue'
// HIDDEN: AI — import SettingsModal from '@/components/settings/SettingsModal.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import Toast from '@/components/ui/Toast.vue'
import ShortcutHelp from '@/components/help/ShortcutHelp.vue'
// HIDDEN: AI — import { useSettings } from '@/composables/useSettings'
import { useUpdater } from '@/composables/useUpdater'

// HIDDEN: AI — const settingsOpen = ref(false)
// HIDDEN: AI — const { loadSettings } = useSettings()
const { checkForUpdate } = useUpdater()

// HIDDEN: AI
// function openSettings() {
//   settingsOpen.value = true
// }

onMounted(() => {
  // HIDDEN: AI — loadSettings()
  checkForUpdate()
})
</script>

<template>
  <AppLayout />
  <CommandPalette />
  <!-- HIDDEN: AI -->
  <!-- <AskPanel /> -->
  <!-- <SettingsModal :open="settingsOpen" @close="settingsOpen = false" /> -->
  <UpdateNotification />
  <ShortcutHelp />
  <Toast />
</template>
