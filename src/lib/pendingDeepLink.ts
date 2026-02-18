import type { ParsedDeepLinkTarget } from './deepLinks'

export interface PendingDeepLinkTarget extends ParsedDeepLinkTarget {
  createdAt: number
}

const STORAGE_KEY = 'dalil:pending-deeplink'

export function setPendingDeepLink(target: ParsedDeepLinkTarget) {
  try {
    const payload: PendingDeepLinkTarget = {
      ...target,
      createdAt: Date.now(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage errors.
  }
}

export function getPendingDeepLink(): PendingDeepLinkTarget | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingDeepLinkTarget
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.collectionId || !parsed.docSlug) return null
    return parsed
  } catch {
    return null
  }
}

export function clearPendingDeepLink() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors.
  }
}
