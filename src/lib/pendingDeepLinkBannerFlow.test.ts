import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dismissPendingDeepLinkAction,
  resumePendingDeepLinkAction,
  switchToPendingProjectAction,
} from './pendingDeepLinkBannerFlow'
import type { PendingDeepLinkTarget } from './pendingDeepLink'

const pending: PendingDeepLinkTarget = {
  projectId: 'project-a',
  collectionId: 'ops',
  docSlug: 'runbooks/deploy',
  anchorId: 'rollback',
  createdAt: 1_700_000_000_000,
}

function makeDeps(overrides: {
  resolvePending?: Parameters<typeof resumePendingDeepLinkAction>[1]['resolvePending']
  switchProject?: Parameters<typeof resumePendingDeepLinkAction>[1]['switchProject']
} = {}) {
  const calls = {
    pushed: [] as Array<{ name: 'doc'; params: { collection: string; slug: string }; hash?: string }>,
    cleared: 0,
    toasts: [] as Array<{ message: string; type: 'info' | 'error' }>,
    switched: [] as string[],
  }

  return {
    calls,
    deps: {
      resolvePending: overrides.resolvePending ?? (async () => ({ status: 'unresolved' as const })),
      pushRoute: async (route: { name: 'doc'; params: { collection: string; slug: string }; hash?: string }) => {
        calls.pushed.push(route)
      },
      addToast: (message: string, type: 'info' | 'error') => {
        calls.toasts.push({ message, type })
      },
      clearPending: () => {
        calls.cleared += 1
      },
      switchProject: overrides.switchProject ?? (async (projectId: string) => {
        calls.switched.push(projectId)
      }),
    },
  }
}

test('resumePendingDeepLinkAction routes exact target and clears pending', async () => {
  const { deps, calls } = makeDeps({
    resolvePending: async () => ({
      status: 'exact',
      route: {
        collection: 'ops',
        slug: 'runbooks/deploy',
        hash: '#rollback',
      },
    }),
  })

  const nextPending = await resumePendingDeepLinkAction(pending, deps)

  assert.equal(nextPending, null)
  assert.equal(calls.cleared, 1)
  assert.deepEqual(calls.pushed, [
    {
      name: 'doc',
      params: { collection: 'ops', slug: 'runbooks/deploy' },
      hash: '#rollback',
    },
  ])
  assert.deepEqual(calls.toasts, [])
})

test('resumePendingDeepLinkAction routes nearest target, shows info toast, and clears pending', async () => {
  const { deps, calls } = makeDeps({
    resolvePending: async () => ({
      status: 'nearest',
      route: {
        collection: 'ops',
        slug: 'runbooks/deployment-overview',
      },
      message: 'Opened nearest available document for the pending deep link',
    }),
  })

  const nextPending = await resumePendingDeepLinkAction(pending, deps)

  assert.equal(nextPending, null)
  assert.equal(calls.cleared, 1)
  assert.deepEqual(calls.pushed, [
    {
      name: 'doc',
      params: { collection: 'ops', slug: 'runbooks/deployment-overview' },
      hash: undefined,
    },
  ])
  assert.deepEqual(calls.toasts, [
    {
      message: 'Opened nearest available document for the pending deep link',
      type: 'info',
    },
  ])
})

test('resumePendingDeepLinkAction keeps pending and shows error toast when unresolved', async () => {
  const { deps, calls } = makeDeps({
    resolvePending: async () => ({
      status: 'unresolved',
      message: 'Could not resolve pending deep link in the active project',
    }),
  })

  const nextPending = await resumePendingDeepLinkAction(pending, deps)

  assert.deepEqual(nextPending, pending)
  assert.equal(calls.cleared, 0)
  assert.deepEqual(calls.pushed, [])
  assert.deepEqual(calls.toasts, [
    {
      message: 'Could not resolve pending deep link in the active project',
      type: 'error',
    },
  ])
})

test('switchToPendingProjectAction switches project then resumes route flow', async () => {
  const { deps, calls } = makeDeps({
    resolvePending: async () => ({
      status: 'exact',
      route: {
        collection: 'ops',
        slug: 'runbooks/deploy',
      },
    }),
  })

  const nextPending = await switchToPendingProjectAction(pending, deps)

  assert.equal(nextPending, null)
  assert.deepEqual(calls.switched, ['project-a'])
  assert.equal(calls.cleared, 1)
  assert.deepEqual(calls.pushed, [
    {
      name: 'doc',
      params: { collection: 'ops', slug: 'runbooks/deploy' },
      hash: undefined,
    },
  ])
})

test('dismissPendingDeepLinkAction clears and nulls pending target', () => {
  const { deps, calls } = makeDeps()
  const nextPending = dismissPendingDeepLinkAction(pending, deps)

  assert.equal(nextPending, null)
  assert.equal(calls.cleared, 1)
})
