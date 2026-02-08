type KeydownHandler = (e: KeyboardEvent) => boolean | void

interface RegisteredHandler {
  priority: number
  handler: KeydownHandler
}

const handlers: RegisteredHandler[] = []
let listening = false

function onKeydown(e: KeyboardEvent) {
  for (const entry of handlers) {
    const handled = entry.handler(e)
    if (handled) return
  }
}

function startListening() {
  if (!listening) {
    window.addEventListener('keydown', onKeydown)
    listening = true
  }
}

function stopListening() {
  if (listening && handlers.length === 0) {
    window.removeEventListener('keydown', onKeydown)
    listening = false
  }
}

/**
 * Register a keydown handler with a priority.
 * Higher priority handlers are called first.
 * Return `true` from the handler to stop propagation to lower-priority handlers.
 *
 * Priority guide:
 *   30 — modal overlays (settings)
 *   20 — panel overlays (AI panel, command palette)
 *   10 — global shortcuts
 *
 * Returns an unregister function.
 */
export function registerKeydownHandler(priority: number, handler: KeydownHandler): () => void {
  const entry: RegisteredHandler = { priority, handler }
  handlers.push(entry)
  handlers.sort((a, b) => b.priority - a.priority)
  startListening()

  return () => {
    const idx = handlers.indexOf(entry)
    if (idx !== -1) handlers.splice(idx, 1)
    stopListening()
  }
}
