/**
 * Convert a string to a URL-friendly slug.
 * Strips numeric prefixes (e.g. "01-foo" -> "foo"), lowercases,
 * replaces spaces and special characters with hyphens,
 * and collapses consecutive hyphens.
 *
 * @param segment - The string to slugify
 * @param stripPrefix - Whether to strip leading numeric prefixes (default: true)
 */
export function toSlug(segment: string, stripPrefix: boolean = true): string {
  let value = segment
  if (stripPrefix) {
    value = value.replace(/^\d+-/, '')
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
