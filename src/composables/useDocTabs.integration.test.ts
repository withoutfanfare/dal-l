import test from 'node:test'
import assert from 'node:assert/strict'
import { ref, nextTick } from 'vue'
import { useDocTabs, __unsafeResetDocTabsForTests } from './useDocTabs'

interface FakeStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

function installLocalStorageMock(): FakeStorage {
  const backing = new Map<string, string>()
  const localStorageMock: FakeStorage = {
    getItem(key: string) {
      return backing.has(key) ? backing.get(key)! : null
    },
    setItem(key: string, value: string) {
      backing.set(key, value)
    },
    removeItem(key: string) {
      backing.delete(key)
    },
    clear() {
      backing.clear()
    },
  }
  ;(globalThis as unknown as { localStorage: FakeStorage }).localStorage = localStorageMock
  return localStorageMock
}

function fakeDocRoute(collection: string, slug: string) {
  return {
    name: 'doc',
    params: { collection, slug },
    fullPath: `/${collection}/${slug}`,
  }
}

test('useDocTabs registerRouter reuses active tab by default and persists', async () => {
  const localStorageMock = installLocalStorageMock()
  localStorageMock.clear()
  __unsafeResetDocTabsForTests({ clearStorage: true })

  const currentRoute = ref(fakeDocRoute('ops', 'a'))
  const router = { currentRoute } as { currentRoute: typeof currentRoute }
  const tabsApi = useDocTabs()
  tabsApi.registerRouter(router as never, () => 'project-a')
  await nextTick()

  let tabs = tabsApi.getTabs('project-a', 'ops')
  assert.deepEqual(tabs.map((item) => item.slug), ['a'])

  currentRoute.value = fakeDocRoute('ops', 'b')
  await nextTick()
  tabs = tabsApi.getTabs('project-a', 'ops')
  assert.deepEqual(tabs.map((item) => item.slug), ['b'])

  const persisted = localStorageMock.getItem('dalil:doc-tabs:v1')
  assert.ok(persisted)
  assert.match(persisted ?? '', /"b"/)
})

test('useDocTabs beginNewTab creates additional tab on next route navigation', async () => {
  const localStorageMock = installLocalStorageMock()
  localStorageMock.clear()
  __unsafeResetDocTabsForTests({ clearStorage: true })

  const currentRoute = ref(fakeDocRoute('ops', 'a'))
  const router = { currentRoute } as { currentRoute: typeof currentRoute }
  const tabsApi = useDocTabs()
  tabsApi.registerRouter(router as never, () => 'project-a')
  await nextTick()

  tabsApi.beginNewTab('project-a', 'ops')
  currentRoute.value = fakeDocRoute('ops', 'b')
  await nextTick()

  const tabs = tabsApi.getTabs('project-a', 'ops')
  assert.deepEqual(tabs.map((item) => item.slug), ['a', 'b'])
})
