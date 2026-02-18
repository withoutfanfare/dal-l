import { createApp } from 'vue'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
import App from './App.vue'
import router from './router'
import { getDocument, listProjects, searchDocuments, setActiveProject } from '@/lib/api'
import { docSlugWithoutCollection, parseDeepLink } from '@/lib/deepLinks'
import { clearPendingDeepLink, setPendingDeepLink } from '@/lib/pendingDeepLink'
import './style.css'
import './composables/useTheme'

createApp(App).use(router).mount('#app')

let unlistenUrl: (() => void) | null = null

function emitDeepLinkStatus(kind: string, message: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent('dalil:deeplink-status', {
    detail: {
      kind,
      message,
      ...detail,
    },
  }))
}

async function resolveDeepLink(url: string) {
  const parsed = parseDeepLink(url)
  if (!parsed) return

  const projects = await listProjects().catch(() => [])

  if (parsed.projectId) {
    const matchingProject = projects.find((project) => project.id === parsed.projectId)
    if (!matchingProject) {
      setPendingDeepLink(parsed)
      emitDeepLinkStatus(
        'missing-project',
        `Project "${parsed.projectId}" is not configured. Add or switch project, then resume from Projects.`,
        { projectId: parsed.projectId, collectionId: parsed.collectionId, docSlug: parsed.docSlug, anchorId: parsed.anchorId },
      )
      await router.push('/projects')
      return
    }
    await setActiveProject(parsed.projectId).catch(() => {})
  }

  const fullSlug = `${parsed.collectionId}/${parsed.docSlug}`
  let anchorMissing = false

  try {
    const doc = await getDocument(fullSlug)
    if (parsed.anchorId) {
      const hash = parsed.anchorId
      anchorMissing = !doc.content_html.includes(`id="${hash}"`) && !doc.content_html.includes(`id='${hash}'`)
    }

    await router.push({
      name: 'doc',
      params: { collection: parsed.collectionId, slug: parsed.docSlug },
      hash: parsed.anchorId ? `#${parsed.anchorId}` : '',
    })

    if (anchorMissing) {
      emitDeepLinkStatus(
        'missing-anchor',
        'Section moved: opened the document, but the exact section anchor no longer exists.',
        { collectionId: parsed.collectionId, docSlug: parsed.docSlug, anchorId: parsed.anchorId },
      )
    }
    clearPendingDeepLink()
    return
  } catch {
    // Fall through to nearest document fallback.
  }

  const querySeed = parsed.docSlug.split('/').pop() || parsed.docSlug
  const results = await searchDocuments(querySeed, parsed.collectionId, 1).catch(() => [])

  if (results.length > 0) {
    const nearest = results[0]
    await router.push({
      name: 'doc',
      params: {
        collection: nearest.collection_id,
        slug: docSlugWithoutCollection(nearest.collection_id, nearest.slug),
      },
    })
    emitDeepLinkStatus(
      'missing-doc-nearest',
      'The original document was not found. Opened the closest match instead.',
      { requestedSlug: parsed.docSlug, resolvedSlug: nearest.slug },
    )
    clearPendingDeepLink()
    return
  }

  await router.push('/')
  emitDeepLinkStatus(
    'missing-doc',
    'The linked document is not available in this project.',
    { requestedSlug: parsed.docSlug },
  )
}

onOpenUrl((urls) => {
  for (const url of urls) {
    void resolveDeepLink(url)
  }
}).then(fn => { unlistenUrl = fn })

if (import.meta.hot) {
  import.meta.hot.dispose(() => { unlistenUrl?.() })
}
