<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '@/layouts/AppLayout.vue'
import CommandPalette from '@/components/search/CommandPalette.vue'
import AskPanel from '@/components/ai/AskPanel.vue'
import SettingsModal from '@/components/settings/SettingsModal.vue'
import UpdateNotification from '@/components/UpdateNotification.vue'
import { useSettings } from '@/composables/useSettings'
import { useUpdater } from '@/composables/useUpdater'

const settingsOpen = ref(false)
const { loadSettings } = useSettings()
const { checkForUpdate } = useUpdater()

function openSettings() {
  settingsOpen.value = true
}

onMounted(() => {
  loadSettings()
  checkForUpdate()
})
</script>

<template>
  <AppLayout @open-settings="openSettings" />
  <CommandPalette />
  <AskPanel />
  <SettingsModal :open="settingsOpen" @close="settingsOpen = false" />
  <UpdateNotification />
</template>
