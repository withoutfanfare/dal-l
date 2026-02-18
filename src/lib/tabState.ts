export interface DocTab {
  slug: string
  title: string
  lastOpenedAt: number
  pinned?: boolean
}

export interface TabBucket {
  tabs: DocTab[]
  activeSlug: string | null
}

export function defaultTitleFromSlug(slug: string): string {
  const tail = slug.split('/').filter(Boolean).pop() ?? slug
  return tail
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function upsertTabInBucket(
  bucket: TabBucket,
  slug: string,
  title: string,
  now: number = Date.now(),
) {
  const idx = bucket.tabs.findIndex((tab) => tab.slug === slug)

  if (idx >= 0) {
    bucket.tabs[idx] = {
      ...bucket.tabs[idx],
      title: title || bucket.tabs[idx].title,
      lastOpenedAt: now,
    }
  } else {
    bucket.tabs.push({
      slug,
      title: title || defaultTitleFromSlug(slug),
      lastOpenedAt: now,
    })
  }
  bucket.activeSlug = slug
}

export function syncRouteToTabBucket(
  bucket: TabBucket,
  slug: string,
  title: string,
  createNewTab: boolean,
  now: number = Date.now(),
) {
  const nextTitle = title || defaultTitleFromSlug(slug)

  if (bucket.tabs.length === 0) {
    bucket.tabs.push({ slug, title: nextTitle, lastOpenedAt: now })
    bucket.activeSlug = slug
    return
  }

  if (createNewTab) {
    upsertTabInBucket(bucket, slug, nextTitle, now)
    return
  }

  const activeIdx = bucket.activeSlug
    ? bucket.tabs.findIndex((tab) => tab.slug === bucket.activeSlug)
    : -1
  if (activeIdx < 0) {
    upsertTabInBucket(bucket, slug, nextTitle, now)
    return
  }

  const active = bucket.tabs[activeIdx]
  bucket.tabs[activeIdx] = {
    ...active,
    slug,
    title: nextTitle,
    lastOpenedAt: now,
  }
  bucket.activeSlug = slug
}

export function moveTabInBucket(bucket: TabBucket, slug: string, targetIndex: number) {
  const fromIndex = bucket.tabs.findIndex((item) => item.slug === slug)
  if (fromIndex < 0) return
  const boundedIndex = Math.max(0, Math.min(targetIndex, bucket.tabs.length - 1))
  if (fromIndex === boundedIndex) return
  const [moved] = bucket.tabs.splice(fromIndex, 1)
  bucket.tabs.splice(boundedIndex, 0, moved)
}

export function getAdjacentSlugInBucket(
  bucket: TabBucket,
  slug: string,
  direction: -1 | 1,
): string | null {
  if (bucket.tabs.length === 0) return null
  const currentIndex = bucket.tabs.findIndex((item) => item.slug === slug)
  if (currentIndex < 0) return bucket.tabs[0]?.slug ?? null
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= bucket.tabs.length) return null
  return bucket.tabs[nextIndex]?.slug ?? null
}

export function togglePinInBucket(
  bucket: TabBucket,
  slug: string,
  now: number = Date.now(),
): boolean | null {
  const idx = bucket.tabs.findIndex((item) => item.slug === slug)
  if (idx < 0) return null

  const current = bucket.tabs[idx]
  const nextPinned = !current.pinned
  bucket.tabs[idx] = {
    ...current,
    pinned: nextPinned,
    lastOpenedAt: now,
  }
  const [moved] = bucket.tabs.splice(idx, 1)

  if (nextPinned) {
    const firstUnpinnedIndex = bucket.tabs.findIndex((item) => !item.pinned)
    const targetIndex = firstUnpinnedIndex === -1 ? bucket.tabs.length : firstUnpinnedIndex
    bucket.tabs.splice(targetIndex, 0, moved)
  } else {
    let lastPinnedIndex = -1
    for (let i = bucket.tabs.length - 1; i >= 0; i -= 1) {
      if (bucket.tabs[i].pinned) {
        lastPinnedIndex = i
        break
      }
    }
    bucket.tabs.splice(lastPinnedIndex + 1, 0, moved)
  }

  return nextPinned
}

export function closeUnpinnedTabsInBucket(bucket: TabBucket): string | null {
  const kept = bucket.tabs.filter((tab) => tab.pinned)
  if (kept.length === bucket.tabs.length) {
    return bucket.activeSlug
  }

  const activeTab = bucket.tabs.find((tab) => tab.slug === bucket.activeSlug) ?? null
  bucket.tabs = kept
  if (!activeTab?.pinned) {
    bucket.activeSlug = kept[kept.length - 1]?.slug ?? null
  }
  return bucket.activeSlug
}
