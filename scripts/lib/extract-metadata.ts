import path from 'path'

export interface DocumentMetadata {
  slug: string
  title: string
  section: string
  sortOrder: number
  parentSlug: string
  relativePath: string
}

/**
 * Strip a leading numeric prefix from a path segment.
 * e.g. "01-Development Guidelines" -> "Development Guidelines"
 *      "02-branching-guidelines" -> "branching-guidelines"
 *      "no-prefix" -> "no-prefix"
 */
function stripNumericPrefix(segment: string): string {
  return segment.replace(/^\d+-/, '')
}

/**
 * Extract the numeric prefix from a path segment as a sort order.
 * Returns 999 if no numeric prefix is found.
 */
function extractSortOrder(segment: string): number {
  const match = segment.match(/^(\d+)-/)
  return match ? parseInt(match[1], 10) : 999
}

/**
 * Convert a string to a URL-friendly slug.
 * Strips numeric prefixes, lowercases, replaces spaces and special chars with hyphens,
 * and collapses consecutive hyphens.
 */
function toSlug(segment: string): string {
  return stripNumericPrefix(segment)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Clean a directory name for display as a section title.
 * Strips numeric prefix and converts kebab-case to Title Case.
 */
function cleanSectionName(dirName: string): string {
  return stripNumericPrefix(dirName)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function extractMetadata(
  filePath: string,
  collectionSourceDir: string,
): DocumentMetadata {
  const relativePath = path.relative(collectionSourceDir, filePath)
  const parsed = path.parse(relativePath)
  const segments = parsed.dir ? parsed.dir.split(path.sep) : []
  const fileName = parsed.name
  const isIndex =
    fileName.toLowerCase() === 'readme' || fileName.endsWith('-index')

  // Build the slug from directory segments + filename
  const dirSlugParts = segments.map(toSlug)

  let slug: string
  if (isIndex) {
    // Index files get their parent directory's slug
    slug = dirSlugParts.length > 0 ? dirSlugParts.join('/') : toSlug(fileName)
  } else {
    slug = [...dirSlugParts, toSlug(fileName)].join('/')
  }

  // Sort order comes from the file's own numeric prefix,
  // or from the parent directory prefix for index files
  let sortOrder: number
  if (isIndex && segments.length > 0) {
    sortOrder = extractSortOrder(segments[segments.length - 1])
  } else {
    sortOrder = extractSortOrder(parsed.base)
  }

  // Section is the top-level directory name, cleaned of numeric prefix
  const section = segments.length > 0 ? cleanSectionName(segments[0]) : ''

  // Parent slug is the slug of the parent directory
  const parentSlug = dirSlugParts.length > 0 ? dirSlugParts.join('/') : ''

  // Title placeholder from filename (will be overridden from frontmatter/H1 later)
  const titleSource = isIndex && segments.length > 0
    ? stripNumericPrefix(segments[segments.length - 1])
    : stripNumericPrefix(fileName)
  const title = titleSource
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    slug,
    title,
    section,
    sortOrder,
    parentSlug,
    relativePath,
  }
}
