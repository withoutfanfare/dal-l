export interface DeepLinkTarget {
  projectId: string
  collectionId: string
  docSlug: string
  anchorId?: string
}

export interface ParsedDeepLinkTarget {
  projectId?: string
  collectionId: string
  docSlug: string
  anchorId?: string
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function encodePath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

export function buildDeepLink(target: DeepLinkTarget): string {
  const base = `dalil://project/${encodeURIComponent(target.projectId)}/collection/${encodeURIComponent(target.collectionId)}/doc/${encodePath(target.docSlug)}`
  if (!target.anchorId) return base
  return `${base}#${encodeURIComponent(target.anchorId)}`
}

export function parseDeepLink(rawUrl: string): ParsedDeepLinkTarget | null {
  const url = rawUrl.trim()

  // v2 format:
  // dalil://project/{projectId}/collection/{collectionId}/doc/{docSlug}#anchor
  const v2 = url.match(/^dalil:\/\/project\/([^/]+)\/collection\/([^/]+)\/doc\/(.+)$/)
  if (v2) {
    const [, projectPart, collectionPart, docPartWithHash] = v2
    const [docPart, hashPart] = docPartWithHash.split('#')
    return {
      projectId: decode(projectPart),
      collectionId: decode(collectionPart),
      docSlug: decode(docPart),
      anchorId: hashPart ? decode(hashPart) : undefined,
    }
  }

  // Legacy format:
  // dalil://{collectionId}/{docSlug}#anchor
  const legacy = url.match(/^dalil:\/\/([^/]+)\/(.+)$/)
  if (legacy) {
    const [, collectionPart, docPartWithHash] = legacy
    const [docPart, hashPart] = docPartWithHash.split('#')
    return {
      collectionId: decode(collectionPart),
      docSlug: decode(docPart),
      anchorId: hashPart ? decode(hashPart) : undefined,
    }
  }

  return null
}

export function docSlugWithoutCollection(collectionId: string, fullSlug: string): string {
  const prefix = `${collectionId}/`
  return fullSlug.startsWith(prefix) ? fullSlug.slice(prefix.length) : fullSlug
}
