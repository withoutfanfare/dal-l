import { createApp } from 'vue'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import App from './App.vue'
import router from './router'
import './style.css'
import './composables/useTheme'

createApp(App).use(router).mount('#app')

let unlistenUrl: (() => void) | null = null

onOpenUrl((urls) => {
  for (const url of urls) {
    const stripped = url.replace(/^dalil:\/\//, '')
    if (stripped) {
      const path = stripped.startsWith('/') ? stripped : `/${stripped}`
      // Validate the deep-link path before routing
      const resolved = router.resolve(path)
      if (resolved.matched.length > 0) {
        router.push(path)
      }
    }
  }
}).then(fn => { unlistenUrl = fn })

if (import.meta.hot) {
  import.meta.hot.dispose(() => { unlistenUrl?.() })
}
