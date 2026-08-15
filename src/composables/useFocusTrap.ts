import { onUnmounted, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(containerRef: Ref<HTMLElement | null>, isActive: Ref<boolean>) {
  let previouslyFocused: HTMLElement | null = null
  let trappedElement: HTMLElement | null = null
  let addedTabIndex = false

  function getFocusableElements(): HTMLElement[] {
    if (!trappedElement) return []
    return Array.from(trappedElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => (
        el.offsetParent !== null
        && !el.matches(':disabled, [disabled]')
        && el.closest('[inert]') === null
      ))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !trappedElement) return

    const focusable = getFocusableElements()
    if (focusable.length === 0) {
      e.preventDefault()
      trappedElement.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const activeElement = document.activeElement

    if (!activeElement || !trappedElement.contains(activeElement)) {
      e.preventDefault()
      const focusTarget = e.shiftKey ? last : first
      focusTarget.focus()
      return
    }

    if (e.shiftKey) {
      if (activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function onFocusIn(e: FocusEvent) {
    const target = e.target as Node | null
    if (!trappedElement || !target || trappedElement.contains(target)) return

    const [firstFocusable] = getFocusableElements()
    const focusTarget = firstFocusable ?? trappedElement
    focusTarget.focus()
  }

  function activate() {
    const container = containerRef.value
    if (!container || trappedElement === container) return

    if (trappedElement) {
      if (addedTabIndex) trappedElement.removeAttribute('tabindex')
    } else {
      previouslyFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    }

    trappedElement = container
    addedTabIndex = !trappedElement.hasAttribute('tabindex')
    if (addedTabIndex) trappedElement.setAttribute('tabindex', '-1')
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('focusin', onFocusIn)
  }

  function deactivate() {
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('focusin', onFocusIn)
    if (trappedElement && addedTabIndex) {
      trappedElement.removeAttribute('tabindex')
    }
    trappedElement = null
    addedTabIndex = false
    previouslyFocused?.focus()
    previouslyFocused = null
  }

  watch([isActive, containerRef], ([active]) => {
    if (active) {
      activate()
    } else {
      deactivate()
    }
  }, { immediate: true })

  onUnmounted(deactivate)

  return { activate, deactivate }
}
