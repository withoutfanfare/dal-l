export interface ContentChunk {
  chunkIndex: number
  contentText: string
  headingContext: string
}

/**
 * Estimate token count from text using word count / 0.75 approximation.
 */
function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.ceil(words / 0.75)
}

/**
 * Split text into sentences, preserving trailing whitespace with each sentence.
 */
function splitSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g)
  if (!sentences) return [text]
  const joined = sentences.join('')
  if (joined.length < text.length) {
    sentences.push(text.slice(joined.length))
  }
  return sentences.filter(Boolean)
}

interface Section {
  heading: string
  content: string
}

/**
 * Split markdown into sections by headings.
 */
function splitByHeadings(markdown: string): Section[] {
  const lines = markdown.split('\n')
  const sections: Section[] = []
  let currentHeading = ''
  let currentLines: string[] = []

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      if (currentLines.length > 0 || sections.length === 0) {
        sections.push({ heading: currentHeading, content: currentLines.join('\n') })
      }
      currentHeading = line.replace(/^#{1,6}\s+/, '').trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }

  sections.push({ heading: currentHeading, content: currentLines.join('\n') })

  return sections.filter((s) => s.content.trim().length > 0)
}

/**
 * Split a section's content into paragraph blocks (separated by double newlines).
 */
function splitParagraphs(content: string): string[] {
  return content.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
}

/**
 * Build chunks from a list of text blocks, merging small ones and splitting large ones.
 */
function buildChunks(
  blocks: string[],
  heading: string,
  targetTokens: number,
  overlapTokens: number,
  chunks: ContentChunk[],
  previousChunkTail: string,
): string {
  let buffer = previousChunkTail
  let tail = ''

  for (const block of blocks) {
    const blockTokens = estimateTokens(block)

    if (blockTokens > targetTokens) {
      // Flush buffer before handling the oversized block
      if (buffer.trim()) {
        chunks.push({
          chunkIndex: chunks.length,
          contentText: buffer.trim(),
          headingContext: heading,
        })
        tail = extractTail(buffer, overlapTokens)
        buffer = ''
      }

      // Split large block by sentences
      const sentences = splitSentences(block)
      let sentenceBuffer = tail

      for (const sentence of sentences) {
        if (estimateTokens(sentenceBuffer + sentence) > targetTokens && sentenceBuffer.trim()) {
          chunks.push({
            chunkIndex: chunks.length,
            contentText: sentenceBuffer.trim(),
            headingContext: heading,
          })
          tail = extractTail(sentenceBuffer, overlapTokens)
          sentenceBuffer = tail + sentence
        } else {
          sentenceBuffer += sentence
        }
      }

      buffer = sentenceBuffer
      continue
    }

    if (estimateTokens(buffer + '\n\n' + block) > targetTokens && buffer.trim()) {
      chunks.push({
        chunkIndex: chunks.length,
        contentText: buffer.trim(),
        headingContext: heading,
      })
      tail = extractTail(buffer, overlapTokens)
      buffer = tail + block
    } else {
      buffer = buffer ? buffer + '\n\n' + block : block
    }
  }

  return buffer
}

/**
 * Extract the last N tokens worth of text from a string for overlap.
 */
function extractTail(text: string, overlapTokens: number): string {
  if (overlapTokens <= 0) return ''
  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = Math.ceil(overlapTokens * 0.75)
  if (words.length <= wordCount) return text
  return words.slice(-wordCount).join(' ') + ' '
}

export function chunkContent(
  markdownContent: string,
  targetTokens: number = 500,
  overlapTokens: number = 50,
): ContentChunk[] {
  if (!markdownContent.trim()) return []

  const sections = splitByHeadings(markdownContent)
  if (sections.length === 0) return []

  const chunks: ContentChunk[] = []
  let carryOver = ''

  for (const section of sections) {
    const heading = section.heading
    const sectionTokens = estimateTokens(section.content)

    if (sectionTokens <= targetTokens) {
      const combined = carryOver ? carryOver + '\n\n' + section.content : section.content
      if (estimateTokens(combined) <= targetTokens) {
        carryOver = combined
        // Update heading context for the carry-over to the latest heading
        continue
      }
      // Flush carry-over
      if (carryOver.trim()) {
        chunks.push({
          chunkIndex: chunks.length,
          contentText: carryOver.trim(),
          headingContext: heading,
        })
        carryOver = extractTail(carryOver, overlapTokens) + section.content
      } else {
        carryOver = section.content
      }
      continue
    }

    // Section exceeds target — split by paragraphs
    const paragraphs = splitParagraphs(section.content)
    const previousTail = carryOver.trim()
      ? (() => {
          chunks.push({
            chunkIndex: chunks.length,
            contentText: carryOver.trim(),
            headingContext: heading,
          })
          const t = extractTail(carryOver, overlapTokens)
          carryOver = ''
          return t
        })()
      : ''

    carryOver = buildChunks(paragraphs, heading, targetTokens, overlapTokens, chunks, previousTail)
  }

  // Flush any remaining buffer
  if (carryOver.trim()) {
    const lastHeading = sections[sections.length - 1].heading
    chunks.push({
      chunkIndex: chunks.length,
      contentText: carryOver.trim(),
      headingContext: lastHeading,
    })
  }

  return chunks
}
