import test from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import DOMPurify from 'dompurify'

// Create a DOM environment for DOMPurify — mirrors src/lib/sanitise.ts config exactly
const window = new Window()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const purify = DOMPurify(window as any)

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

function sanitiseHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: [...SAFE_ATTR, 'style'],
    ALLOW_DATA_ATTR: false,
  })
}

function sanitiseAiHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: SAFE_TAGS,
    ALLOWED_ATTR: SAFE_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}

function sanitiseSnippet(html: string): string {
  return purify.sanitize(html, { ALLOWED_TAGS: ['mark'], ALLOWED_ATTR: [] })
}

// ── sanitiseHtml (handbook content — trusted, with Shiki style support) ──

test('sanitiseHtml: strips <script> tags', () => {
  assert.equal(sanitiseHtml('<script>alert("xss")</script>'), '')
  assert.equal(sanitiseHtml('<p>Hello</p><script>document.cookie</script>'), '<p>Hello</p>')
})

test('sanitiseHtml: strips <script> tags with attributes', () => {
  assert.equal(sanitiseHtml('<script src="evil.js"></script>'), '')
  assert.equal(sanitiseHtml('<script type="text/javascript">alert(1)</script>'), '')
})

test('sanitiseHtml: strips onerror event handler', () => {
  const result = sanitiseHtml('<img src="x" onerror="alert(1)">')
  assert.ok(!result.includes('onerror'), `onerror not stripped: ${result}`)
  assert.ok(result.includes('<img'), 'img tag should be preserved')
})

test('sanitiseHtml: strips onload event handler', () => {
  const result = sanitiseHtml('<img src="x" onload="alert(1)">')
  assert.ok(!result.includes('onload'), `onload not stripped: ${result}`)
})

test('sanitiseHtml: strips onclick event handler', () => {
  const result = sanitiseHtml('<div onclick="alert(1)">Click me</div>')
  assert.ok(!result.includes('onclick'), `onclick not stripped: ${result}`)
  assert.ok(result.includes('Click me'), 'text content preserved')
})

test('sanitiseHtml: strips onmouseover event handler', () => {
  const result = sanitiseHtml('<a href="#" onmouseover="alert(1)">hover</a>')
  assert.ok(!result.includes('onmouseover'), `onmouseover not stripped: ${result}`)
})

test('sanitiseHtml: strips javascript: protocol in href', () => {
  const result = sanitiseHtml('<a href="javascript:alert(1)">click</a>')
  assert.ok(!result.includes('javascript:'), `javascript: not stripped: ${result}`)
})

test('sanitiseHtml: strips HTML-encoded javascript: protocol', () => {
  const result = sanitiseHtml('<a href="&#106;avascript:alert(1)">click</a>')
  assert.ok(!result.includes('javascript:'), `encoded javascript: not stripped: ${result}`)
})

test('sanitiseHtml: strips iframe tags', () => {
  assert.equal(sanitiseHtml('<iframe src="evil.html"></iframe>'), '')
})

test('sanitiseHtml: strips object and embed tags', () => {
  assert.equal(sanitiseHtml('<object data="evil.swf"></object>'), '')
  assert.equal(sanitiseHtml('<embed src="evil.swf">'), '')
})

test('sanitiseHtml: strips SVG with script injection', () => {
  const result = sanitiseHtml('<svg onload="alert(1)"><circle r="10"></circle></svg>')
  assert.ok(!result.includes('onload'), `SVG onload not stripped: ${result}`)
  assert.ok(!result.includes('<svg'), `SVG tag not allowed: ${result}`)
})

test('sanitiseHtml: strips form and input elements', () => {
  const result = sanitiseHtml('<form action="evil"><input type="text"></form>')
  assert.ok(!result.includes('<form'), `form tag stripped: ${result}`)
  assert.ok(!result.includes('action='), `form action stripped: ${result}`)
})

test('sanitiseHtml: strips base tag', () => {
  assert.equal(sanitiseHtml('<base href="https://evil.com">'), '')
})

test('sanitiseHtml: strips meta refresh redirect', () => {
  assert.equal(sanitiseHtml('<meta http-equiv="refresh" content="0;url=evil">'), '')
})

test('sanitiseHtml: strips data-* attributes', () => {
  const result = sanitiseHtml('<div data-custom="value">content</div>')
  assert.ok(!result.includes('data-custom'), `data-* not stripped: ${result}`)
})

test('sanitiseHtml: preserves safe HTML structure', () => {
  const result = sanitiseHtml('<h2 id="title">Title</h2><p>Text with <strong>bold</strong> and <code>code</code>.</p>')
  assert.ok(result.includes('<h2'), 'h2 tag preserved')
  assert.ok(result.includes('Title</h2>'), 'heading text preserved')
  assert.ok(result.includes('<strong>bold</strong>'), 'strong preserved')
  assert.ok(result.includes('<code>code</code>'), 'code preserved')
})

test('sanitiseHtml: preserves Shiki style attributes on code spans', () => {
  const input = '<pre><code><span style="color:#e1e4e8">const</span></code></pre>'
  const result = sanitiseHtml(input)
  assert.ok(result.includes('style="color:#e1e4e8"'), `style attr preserved: ${result}`)
})

test('sanitiseHtml: preserves safe links', () => {
  const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>'
  assert.equal(sanitiseHtml(input), input)
})

test('sanitiseHtml: preserves mark tags', () => {
  const input = '<p>Search <mark>result</mark> highlight</p>'
  assert.equal(sanitiseHtml(input), input)
})

// ── sanitiseAiHtml (AI responses — potentially adversarial, no style) ──

test('sanitiseAiHtml: strips <script> tags', () => {
  assert.equal(sanitiseAiHtml('<script>alert("xss")</script>'), '')
})

test('sanitiseAiHtml: strips onerror event handler', () => {
  const result = sanitiseAiHtml('<img src="x" onerror="alert(1)">')
  assert.ok(!result.includes('onerror'), `onerror not stripped: ${result}`)
})

test('sanitiseAiHtml: strips javascript: protocol', () => {
  const result = sanitiseAiHtml('<a href="javascript:alert(1)">click</a>')
  assert.ok(!result.includes('javascript:'), `javascript: not stripped: ${result}`)
})

test('sanitiseAiHtml: strips style attribute (CSS exfiltration defence)', () => {
  const result = sanitiseAiHtml('<div style="background:url(evil)">text</div>')
  assert.ok(!result.includes('style='), `style attr should be stripped: ${result}`)
  assert.ok(result.includes('text'), 'text content preserved')
})

test('sanitiseAiHtml: preserves safe markdown-derived HTML', () => {
  const input = '<p>Text with <strong>bold</strong>, <em>italic</em>, and <code>code</code>.</p>'
  assert.equal(sanitiseAiHtml(input), input)
})

test('sanitiseAiHtml: strips iframe and embed', () => {
  assert.equal(sanitiseAiHtml('<iframe src="evil"></iframe>'), '')
  assert.equal(sanitiseAiHtml('<embed src="evil">'), '')
})

// ── sanitiseSnippet (FTS5 search snippets — only <mark> allowed) ──

test('sanitiseSnippet: strips <script> tags', () => {
  assert.equal(sanitiseSnippet('<script>alert(1)</script>'), '')
})

test('sanitiseSnippet: strips onerror handlers', () => {
  const result = sanitiseSnippet('<img src=x onerror=alert(1)>')
  assert.ok(!result.includes('onerror'), `snippet onerror not stripped: ${result}`)
  assert.ok(!result.includes('<img'), 'img not allowed in snippets')
})

test('sanitiseSnippet: strips javascript: protocol', () => {
  const result = sanitiseSnippet('<a href="javascript:alert(1)">click</a>')
  assert.ok(!result.includes('javascript:'), `snippet javascript: not stripped: ${result}`)
  assert.ok(!result.includes('<a'), 'anchor not allowed in snippets')
})

test('sanitiseSnippet: preserves only <mark> tags', () => {
  const input = 'Search <mark>keyword</mark> in <strong>text</strong>'
  const result = sanitiseSnippet(input)
  assert.ok(result.includes('<mark>keyword</mark>'), `mark preserved: ${result}`)
  assert.ok(!result.includes('<strong>'), `strong stripped: ${result}`)
})

test('sanitiseSnippet: strips all attributes from mark', () => {
  const input = '<mark class="highlight" onclick="alert(1)">text</mark>'
  assert.equal(sanitiseSnippet(input), '<mark>text</mark>')
})

test('sanitiseSnippet: handles nested malicious tags', () => {
  const input = '<mark><script>alert(1)</script>text</mark>'
  const result = sanitiseSnippet(input)
  assert.ok(!result.includes('<script>'), `nested script stripped: ${result}`)
  assert.ok(result.includes('text'), 'text content preserved')
})
