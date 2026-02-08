import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'dalil-theme-mode'

const mode = ref<ThemeMode>(
  (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system'
)

const systemPrefersDark = ref(
  window.matchMedia('(prefers-color-scheme: dark)').matches
)

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
function handleMediaChange(e: MediaQueryListEvent) {
  systemPrefersDark.value = e.matches
}
mediaQuery.addEventListener('change', handleMediaChange)

const isDark = computed(() => {
  if (mode.value === 'system') return systemPrefersDark.value
  return mode.value === 'dark'
})

function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

// Apply immediately on module load
applyTheme()

// Watch for changes
watch(isDark, applyTheme)
watch(mode, (newMode) => {
  localStorage.setItem(STORAGE_KEY, newMode)
})

export function useTheme() {
  function setMode(newMode: ThemeMode) {
    mode.value = newMode
  }

  function toggleTheme() {
    const cycle: ThemeMode[] = ['system', 'light', 'dark']
    const currentIndex = cycle.indexOf(mode.value)
    mode.value = cycle[(currentIndex + 1) % cycle.length]
  }

  return { mode, isDark, setMode, toggleTheme }
}
