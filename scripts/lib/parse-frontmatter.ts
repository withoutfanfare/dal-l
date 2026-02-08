import matter from 'gray-matter'

export interface ParsedDocument {
  content: string
  title: string
  tags: string[]
}

export function parseFrontmatter(fileContent: string, fallbackTitle: string): ParsedDocument {
  const { data, content } = matter(fileContent)

  const title = data.title ?? extractH1(content) ?? fallbackTitle
  const tags: string[] = Array.isArray(data.tags) ? data.tags : []

  return { content, title, tags }
}

function extractH1(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : null
}
