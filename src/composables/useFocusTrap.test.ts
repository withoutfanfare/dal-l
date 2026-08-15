import assert from 'node:assert/strict'
import test from 'node:test'
import { Window } from 'happy-dom'

function installDom() {
  const happyWindow = new Window({ url: 'http://localhost' })

  Object.assign(globalThis, {
    document: happyWindow.document,
    Element: happyWindow.Element,
    Event: happyWindow.Event,
    HTMLElement: happyWindow.HTMLElement,
    KeyboardEvent: happyWindow.KeyboardEvent,
    Node: happyWindow.Node,
    SVGElement: happyWindow.SVGElement,
    window: happyWindow,
  })
}

installDom()

test('an initially active trap restores focus and removes its listener on unmount', async () => {
  document.body.innerHTML = ''
  const { createApp, defineComponent, h, nextTick, ref } = await import('vue')
  const { useFocusTrap } = await import('./useFocusTrap')

  const trigger = document.createElement('button')
  const host = document.createElement('div')
  document.body.append(trigger, host)
  trigger.focus()

  const component = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, ref(true))

      return () => h('div', { ref: containerRef }, [
        h('button', 'First'),
        h('button', 'Last'),
      ])
    },
  })

  const app = createApp(component)
  app.mount(host)
  await nextTick()

  const trappedContainer = host.querySelector<HTMLDivElement>('div')!
  const buttons = Array.from(trappedContainer.querySelectorAll('button'))
  for (const button of buttons) {
    Object.defineProperty(button, 'offsetParent', {
      configurable: true,
      value: trappedContainer,
    })
  }

  buttons[1].focus()
  trappedContainer.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
  }))

  assert.equal(document.activeElement, buttons[0])

  app.unmount()

  assert.equal(document.activeElement, trigger)

  let keyReads = 0
  const keydown = new Event('keydown')
  Object.defineProperty(keydown, 'key', {
    get() {
      keyReads += 1
      return 'Escape'
    },
  })
  document.dispatchEvent(keydown)

  assert.equal(keyReads, 0)
})

test('returns focus to an active trap when focus moves outside it', async () => {
  document.body.innerHTML = ''
  const { createApp, defineComponent, h, nextTick, ref } = await import('vue')
  const { useFocusTrap } = await import('./useFocusTrap')

  const trigger = document.createElement('button')
  const host = document.createElement('div')
  document.body.append(trigger, host)

  const component = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, ref(true))

      return () => h('div', { ref: containerRef }, [
        h('button', 'First'),
        h('button', 'Last'),
      ])
    },
  })

  const app = createApp(component)
  app.mount(host)
  await nextTick()

  const trappedContainer = host.querySelector<HTMLDivElement>('div')!
  const buttons = Array.from(trappedContainer.querySelectorAll('button'))
  for (const button of buttons) {
    Object.defineProperty(button, 'offsetParent', {
      configurable: true,
      value: trappedContainer,
    })
  }

  trigger.focus()

  assert.equal(document.activeElement, buttons[0])

  app.unmount()
})

test('focuses the trap container when it has no focusable children', async () => {
  document.body.innerHTML = ''
  const { createApp, defineComponent, h, nextTick, ref } = await import('vue')
  const { useFocusTrap } = await import('./useFocusTrap')

  const trigger = document.createElement('button')
  const host = document.createElement('div')
  document.body.append(trigger, host)

  const component = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, ref(true))

      return () => h('div', { ref: containerRef })
    },
  })

  const app = createApp(component)
  app.mount(host)
  await nextTick()

  const trappedContainer = host.querySelector<HTMLDivElement>('div')!
  trigger.focus()
  trigger.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
  }))

  assert.equal(trappedContainer.getAttribute('tabindex'), '-1')
  assert.equal(document.activeElement, trappedContainer)

  app.unmount()
})

test('skips disabled controls even when they have a non-negative tabindex', async () => {
  document.body.innerHTML = ''
  const { createApp, defineComponent, h, nextTick, ref } = await import('vue')
  const { useFocusTrap } = await import('./useFocusTrap')

  const host = document.createElement('div')
  document.body.append(host)

  const component = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, ref(true))

      return () => h('div', { ref: containerRef }, [
        h('button', { disabled: true, tabindex: 0 }, 'Disabled'),
        h('button', 'Enabled'),
      ])
    },
  })

  const app = createApp(component)
  app.mount(host)
  await nextTick()

  const trappedContainer = host.querySelector<HTMLDivElement>('div')!
  const buttons = Array.from(trappedContainer.querySelectorAll('button'))
  for (const button of buttons) {
    Object.defineProperty(button, 'offsetParent', {
      configurable: true,
      value: trappedContainer,
    })
  }
  Object.defineProperty(buttons[0], 'focus', {
    configurable: true,
    value() {},
  })

  document.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
  }))

  const activeElement = document.activeElement
  app.unmount()

  assert.equal(activeElement?.textContent, 'Enabled')
})

test('skips focusable controls inside inert content', async () => {
  document.body.innerHTML = ''
  const { createApp, defineComponent, h, nextTick, ref } = await import('vue')
  const { useFocusTrap } = await import('./useFocusTrap')

  const host = document.createElement('div')
  document.body.append(host)

  const component = defineComponent({
    setup() {
      const containerRef = ref<HTMLElement | null>(null)
      useFocusTrap(containerRef, ref(true))

      return () => h('div', { ref: containerRef }, [
        h('div', { inert: true }, [h('button', 'Inert')]),
        h('button', 'Enabled'),
      ])
    },
  })

  const app = createApp(component)
  app.mount(host)
  await nextTick()

  const trappedContainer = host.querySelector<HTMLDivElement>('div')!
  const buttons = Array.from(trappedContainer.querySelectorAll('button'))
  for (const button of buttons) {
    Object.defineProperty(button, 'offsetParent', {
      configurable: true,
      value: trappedContainer,
    })
  }
  Object.defineProperty(buttons[0], 'focus', {
    configurable: true,
    value() {},
  })

  document.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Tab',
  }))

  const activeElement = document.activeElement
  app.unmount()

  assert.equal(activeElement?.textContent, 'Enabled')
})
