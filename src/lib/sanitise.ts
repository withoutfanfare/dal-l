import DOMPurify from 'dompurify'

const purify = DOMPurify(window)

// Allow standard markup from Shiki code highlighting and Tailwind Typography
purify.setConfig({
  ALLOWED_TAGS: [
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
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'id',
    'tabindex',
    'colspan', 'rowspan', 'scope',
    'aria-label', 'aria-hidden', 'role',
    'style',
  ],
  ALLOW_DATA_ATTR: false,
})

export function sanitiseHtml(html: string): string {
  return purify.sanitize(html)
}
