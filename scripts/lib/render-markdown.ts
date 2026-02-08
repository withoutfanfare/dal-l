import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'

type MarkdownProcessor = ReturnType<typeof createPipeline>

function createPipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeShiki, { theme: 'github-light' })
    .use(rehypeStringify, { allowDangerousHtml: true })
}

export function createMarkdownProcessor(): MarkdownProcessor {
  return createPipeline()
}

export async function renderWithProcessor(
  processor: MarkdownProcessor,
  markdown: string,
): Promise<string> {
  const result = await processor.process(markdown)
  return String(result)
}

export async function renderMarkdown(markdown: string): Promise<string> {
  const processor = createMarkdownProcessor()
  return renderWithProcessor(processor, markdown)
}
