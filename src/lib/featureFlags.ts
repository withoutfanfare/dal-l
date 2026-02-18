export type FeatureFlagKey = 'aiPanel' | 'bookmarks'

const defaults: Record<FeatureFlagKey, boolean> = {
  aiPanel: true,
  bookmarks: true,
}

function fromEnv(key: FeatureFlagKey): boolean | undefined {
  const envName = key === 'aiPanel' ? 'VITE_FEATURE_AI_PANEL' : 'VITE_FEATURE_BOOKMARKS'
  const raw = import.meta.env[envName]
  if (raw === undefined) return undefined
  const value = String(raw).trim().toLowerCase()
  if (value === '1' || value === 'true' || value === 'yes') return true
  if (value === '0' || value === 'false' || value === 'no') return false
  return undefined
}

function fromLocalStorage(key: FeatureFlagKey): boolean | undefined {
  try {
    const raw = window.localStorage.getItem(`dalil:feature:${key}`)
    if (raw === null) return undefined
    const value = raw.trim().toLowerCase()
    if (value === '1' || value === 'true' || value === 'yes') return true
    if (value === '0' || value === 'false' || value === 'no') return false
  } catch {
    // Ignore storage failures.
  }
  return undefined
}

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const local = fromLocalStorage(key)
  if (local !== undefined) return local
  const env = fromEnv(key)
  if (env !== undefined) return env
  return defaults[key]
}
