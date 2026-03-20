import DOMPurify from 'dompurify'

const purify = DOMPurify(window)

const SAFE_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
  'code', 'pre', 'span',
  'blockquote', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'img',
  'mark',
  'details', 'summary',
  'dl', 'dt', 'dd',
  'sup', 'sub',
  'div',
]

const SAFE_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
  'class', 'id',
  'tabindex',
  'colspan', 'rowspan', 'scope',
  'aria-label', 'aria-hidden', 'role',
]

/**
 * Sanitise handbook HTML (developer-controlled content with Shiki highlighting).
 * Permits `style` for Shiki per-token CSS custom properties (--shiki-light/dark).
 */
export function sanitiseHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: [...SAFE_ATTR, 'style'],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitise AI response HTML (potentially adversarial content).
 * Strips `style` to prevent CSS exfiltration and UI redress attacks.
 */
export function sanitiseAiHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

/** Sanitise FTS5 search snippets — only `<mark>` tags are permitted. */
export function sanitiseSnippet(html: string): string {
  return purify.sanitize(html, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })
}
