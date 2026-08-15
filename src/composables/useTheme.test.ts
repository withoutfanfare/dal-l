import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'

test('falls back to system mode when the stored theme is unsupported', async () => {
  const happyWindow = new Window({ url: 'http://localhost' })
  Object.assign(globalThis, {
    document: happyWindow.document,
    localStorage: happyWindow.localStorage,
    window: happyWindow,
  })
  localStorage.setItem('dalil-theme-mode', 'sepia')

  const { useTheme } = await import('./useTheme')

  assert.equal(useTheme().mode.value, 'system')
})
