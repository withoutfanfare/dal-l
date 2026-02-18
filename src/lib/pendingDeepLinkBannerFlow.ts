import type { PendingDeepLinkTarget } from './pendingDeepLink'
import type { PendingDeepLinkResolution } from './pendingDeepLinkResolution'

export type PendingBannerToastType = 'info' | 'error'

export interface PendingBannerDocRoute {
  name: 'doc'
  params: {
    collection: string
    slug: string
  }
  hash?: string
}

export interface PendingBannerFlowDeps {
  resolvePending: (pending: PendingDeepLinkTarget) => Promise<PendingDeepLinkResolution>
  pushRoute: (route: PendingBannerDocRoute) => Promise<void>
  addToast: (message: string, type: PendingBannerToastType) => void
  clearPending: () => void
  switchProject: (projectId: string) => Promise<void>
}

function toDocRoute(
  route: NonNullable<PendingDeepLinkResolution['route']>,
): PendingBannerDocRoute {
  return {
    name: 'doc',
    params: {
      collection: route.collection,
      slug: route.slug,
    },
    hash: route.hash,
  }
}

export async function resumePendingDeepLinkAction(
  pending: PendingDeepLinkTarget | null,
  deps: PendingBannerFlowDeps,
): Promise<PendingDeepLinkTarget | null> {
  if (!pending) return null

  const resolution = await deps.resolvePending(pending)

  if (resolution.status === 'exact' && resolution.route) {
    await deps.pushRoute(toDocRoute(resolution.route))
    deps.clearPending()
    return null
  }

  if (resolution.status === 'nearest' && resolution.route) {
    await deps.pushRoute(toDocRoute(resolution.route))
    if (resolution.message) deps.addToast(resolution.message, 'info')
    deps.clearPending()
    return null
  }

  deps.addToast(
    resolution.message ?? 'Could not resolve pending deep link in the active project',
    'error',
  )
  return pending
}

export async function switchToPendingProjectAction(
  pending: PendingDeepLinkTarget | null,
  deps: PendingBannerFlowDeps,
): Promise<PendingDeepLinkTarget | null> {
  if (!pending?.projectId) return pending
  await deps.switchProject(pending.projectId)
  return resumePendingDeepLinkAction(pending, deps)
}

export function dismissPendingDeepLinkAction(
  pending: PendingDeepLinkTarget | null,
  deps: Pick<PendingBannerFlowDeps, 'clearPending'>,
): PendingDeepLinkTarget | null {
  if (!pending) return null
  deps.clearPending()
  return null
}
