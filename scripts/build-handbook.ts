import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'path'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import config from '../dalil.config.js'
import { extractMetadata } from './lib/extract-metadata.js'
import { parseFrontmatter } from './lib/parse-frontmatter.js'
import remarkResolveLinks from './lib/remark-resolve-links.js'
import { buildNavigation, type DocInfo } from './lib/build-navigation.js'
import { chunkContent } from './lib/chunk-content.js'
import {
  createDatabase,
  insertCollection,
  insertDocument,
  insertNavigation,
  insertChunks,
} from './lib/create-database.js'
import type { Collection } from './lib/config.js'

const DB_PATH = path.resolve(import.meta.dirname, '..', 'dalil.db')

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = []

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir)
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        walk(fullPath)
      } else if (entry.endsWith('.md')) {
        files.push(fullPath)
      }
    }
  }

  walk(dir)
  return files
}

function buildSlugMap(
  files: string[],
  sourceDir: string,
): Map<string, string> {
  const slugMap = new Map<string, string>()

  for (const filePath of files) {
    const metadata = extractMetadata(filePath, sourceDir)
    const relativePath = path.relative(sourceDir, filePath)
    slugMap.set(relativePath, metadata.slug)
  }

  return slugMap
}

async function processCollection(
  collection: Collection,
  collectionIndex: number,
  db: ReturnType<typeof createDatabase>,
) {
  const sourceDir = collection.source

  if (!existsSync(sourceDir)) {
    console.warn(`  Warning: source directory not found for "${collection.name}": ${sourceDir}`)
    return
  }

  console.log(`\n  Processing "${collection.name}" from ${sourceDir}`)

  insertCollection(db, {
    id: collection.id,
    name: collection.name,
    icon: collection.icon,
    description: collection.description,
    sortOrder: collectionIndex,
  })

  const files = findMarkdownFiles(sourceDir)
  console.log(`  Found ${files.length} markdown files`)

  const slugMap = buildSlugMap(files, sourceDir)

  // Deduplicate: when README.md and *-index.md both exist in same dir, skip README.md
  const slugToFile = new Map<string, string>()
  for (const filePath of files) {
    const metadata = extractMetadata(filePath, sourceDir)
    const fullSlug = `${collection.id}/${metadata.slug}`
    const existing = slugToFile.get(fullSlug)
    if (existing) {
      // Prefer *-index.md over README.md
      const existingIsReadme = path.basename(existing).toLowerCase() === 'readme.md'
      const currentIsReadme = path.basename(filePath).toLowerCase() === 'readme.md'
      if (existingIsReadme && !currentIsReadme) {
        console.log(`  Skipping ${path.relative(sourceDir, existing)} (duplicate, preferring index file)`)
        slugToFile.set(fullSlug, filePath)
      } else {
        console.log(`  Skipping ${metadata.relativePath} (duplicate slug)`)
      }
    } else {
      slugToFile.set(fullSlug, filePath)
    }
  }
  const deduped = files.filter((filePath) => {
    const metadata = extractMetadata(filePath, sourceDir)
    const fullSlug = `${collection.id}/${metadata.slug}`
    return slugToFile.get(fullSlug) === filePath
  })

  const docInfos: DocInfo[] = []
  let processedCount = 0

  for (const filePath of deduped) {
    const fileContent = readFileSync(filePath, 'utf-8')
    const metadata = extractMetadata(filePath, sourceDir)
    const parsed = parseFrontmatter(fileContent, metadata.title)

    // Build per-file processor with link resolution for this file's context
    const fileProcessor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkResolveLinks, {
        collectionId: collection.id,
        currentFilePath: metadata.relativePath,
        slugMap,
      })
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeSlug)
      .use(rehypeShiki, { theme: 'github-light' })
      .use(rehypeStringify, { allowDangerousHtml: true })

    const contentHtml = String(await fileProcessor.process(parsed.content))

    const fullSlug = `${collection.id}/${metadata.slug}`
    const level = metadata.slug.split('/').length - 1

    const docId = insertDocument(db, {
      collectionId: collection.id,
      slug: fullSlug,
      title: parsed.title,
      section: metadata.section,
      sortOrder: metadata.sortOrder,
      parentSlug: metadata.parentSlug
        ? `${collection.id}/${metadata.parentSlug}`
        : '',
      contentHtml,
      contentRaw: parsed.content,
      path: metadata.relativePath,
      tags: parsed.tags,
    })

    const chunks = chunkContent(parsed.content)
    if (chunks.length > 0) {
      insertChunks(db, docId, chunks)
    }

    docInfos.push({
      slug: metadata.slug,
      title: parsed.title,
      section: metadata.section,
      sortOrder: metadata.sortOrder,
      parentSlug: metadata.parentSlug,
      level,
    })

    processedCount++
    if (processedCount % 10 === 0) {
      process.stdout.write(`  Processed ${processedCount}/${deduped.length} files\r`)
    }
  }

  console.log(`  Processed ${processedCount}/${deduped.length} files`)

  const navNodes = buildNavigation(docInfos)
  insertNavigation(db, collection.id, navNodes)
  console.log(`  Built navigation tree: ${navNodes.length} nodes`)
}

async function main() {
  console.log('dalil — Building handbook database\n')
  console.log(`Database: ${DB_PATH}`)
  console.log(`Collections: ${config.collections.length}`)

  const db = createDatabase(DB_PATH)

  try {
    for (let i = 0; i < config.collections.length; i++) {
      await processCollection(config.collections[i], i, db)
    }

    const docCount = (db.prepare('SELECT count(*) as count FROM documents').get() as { count: number }).count
    const chunkCount = (db.prepare('SELECT count(*) as count FROM chunks').get() as { count: number }).count
    const tagCount = (db.prepare('SELECT count(*) as count FROM tags').get() as { count: number }).count
    const navCount = (db.prepare('SELECT count(*) as count FROM navigation_tree').get() as { count: number }).count

    console.log('\n  Summary:')
    console.log(`  Documents: ${docCount}`)
    console.log(`  Chunks: ${chunkCount}`)
    console.log(`  Tags: ${tagCount}`)
    console.log(`  Navigation nodes: ${navCount}`)
    console.log('\n  Done!')
  } finally {
    db.close()
  }
}

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
