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
  insertDocumentRaw,
  insertNavigationRaw,
  insertChunksRaw,
} from './lib/create-database.js'
import type { Collection } from './lib/config.js'
import type { DocumentMetadata } from './lib/extract-metadata.js'

const DB_PATH = path.resolve(import.meta.dirname, '..', 'dalil.db')
const CONFIG_PATH = path.resolve(import.meta.dirname, '..', 'dalil.config.ts')
const CONCURRENCY = 8

/** Shiki languages explicitly loaded to avoid bundling every grammar. */
const SHIKI_LANGS = [
  'bash',
  'shell',
  'text',
  'php',
  'markdown',
  'yaml',
  'ini',
  'json',
  'javascript',
  'typescript',
  'html',
  'css',
  'sql',
  'diff',
] as const

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

/**
 * Pre-compute metadata for all files once, avoiding repeated calls to extractMetadata.
 */
function buildMetadataCache(
  files: string[],
  sourceDir: string,
): Map<string, DocumentMetadata> {
  const cache = new Map<string, DocumentMetadata>()
  for (const filePath of files) {
    cache.set(filePath, extractMetadata(filePath, sourceDir))
  }
  return cache
}

function buildSlugMap(
  files: string[],
  sourceDir: string,
  metadataCache: Map<string, DocumentMetadata>,
): Map<string, string> {
  const slugMap = new Map<string, string>()

  for (const filePath of files) {
    const metadata = metadataCache.get(filePath)!
    const relativePath = path.relative(sourceDir, filePath)
    slugMap.set(relativePath, metadata.slug)
  }

  return slugMap
}

/** Result of processing a single markdown file (before DB insertion). */
interface ProcessedFile {
  filePath: string
  metadata: DocumentMetadata
  parsed: { content: string; title: string; tags: string[] }
  contentHtml: string
  fullSlug: string
  level: number
}

/**
 * Process markdown files in parallel batches with a concurrency limit.
 */
async function processFilesInParallel(
  files: string[],
  collection: Collection,
  metadataCache: Map<string, DocumentMetadata>,
  slugMap: Map<string, string>,
): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = []
  let processedCount = 0

  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (filePath) => {
        const fileContent = readFileSync(filePath, 'utf-8')
        const metadata = metadataCache.get(filePath)!
        const parsed = parseFrontmatter(fileContent, metadata.title)

        // Each file needs its own processor because remarkResolveLinks
        // requires per-file options (currentFilePath, slugMap context).
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
          .use(rehypeShiki, {
            themes: { light: 'github-light', dark: 'github-dark' },
            defaultColor: false,
            langs: [...SHIKI_LANGS],
          })
          .use(rehypeStringify, { allowDangerousHtml: true })

        const contentHtml = String(await fileProcessor.process(parsed.content))

        const fullSlug = `${collection.id}/${metadata.slug}`
        const level = metadata.slug.split('/').length - 1

        return { filePath, metadata, parsed, contentHtml, fullSlug, level }
      }),
    )

    results.push(...batchResults)
    processedCount += batch.length

    if (processedCount % 10 === 0 || processedCount === files.length) {
      process.stdout.write(`  Processed ${processedCount}/${files.length} files\r`)
    }
  }

  return results
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

  const files = findMarkdownFiles(sourceDir)
  console.log(`  Found ${files.length} markdown files`)

  // Extract metadata once per file and cache the results
  const metadataCache = buildMetadataCache(files, sourceDir)
  const slugMap = buildSlugMap(files, sourceDir, metadataCache)

  // Deduplicate: when README.md and *-index.md both exist in same dir, skip README.md
  const slugToFile = new Map<string, string>()
  for (const filePath of files) {
    const metadata = metadataCache.get(filePath)!
    const fullSlug = `${collection.id}/${metadata.slug}`
    const existing = slugToFile.get(fullSlug)
    if (existing) {
      const existingIsReadme = path.basename(existing).toLowerCase() === 'readme.md'
      const currentIsReadme = path.basename(filePath).toLowerCase() === 'readme.md'
      if (existingIsReadme && !currentIsReadme) {
        console.log(`  Skipping ${path.relative(sourceDir, existing)} (duplicate, preferring index file)`)
        slugToFile.set(fullSlug, filePath)
      } else {
        console.log(`  Skipping ${metadataCache.get(filePath)!.relativePath} (duplicate slug)`)
      }
    } else {
      slugToFile.set(fullSlug, filePath)
    }
  }
  const deduped = files.filter((filePath) => {
    const metadata = metadataCache.get(filePath)!
    const fullSlug = `${collection.id}/${metadata.slug}`
    return slugToFile.get(fullSlug) === filePath
  })

  // Phase 1: Process all markdown files in parallel (CPU-bound)
  const processedFiles = await processFilesInParallel(
    deduped,
    collection,
    metadataCache,
    slugMap,
  )
  console.log(`  Processed ${processedFiles.length}/${deduped.length} files`)

  // Phase 2: Insert into DB sequentially (synchronous, wrapped in outer transaction)
  insertCollection(db, {
    id: collection.id,
    name: collection.name,
    icon: collection.icon,
    description: collection.description,
    sortOrder: collectionIndex,
  })

  const docInfos: DocInfo[] = []

  for (const file of processedFiles) {
    const fileMtime = statSync(file.filePath).mtime.toISOString()
    const docId = insertDocumentRaw(db, {
      collectionId: collection.id,
      slug: file.fullSlug,
      title: file.parsed.title,
      section: file.metadata.section,
      sortOrder: file.metadata.sortOrder,
      parentSlug: file.metadata.parentSlug
        ? `${collection.id}/${file.metadata.parentSlug}`
        : '',
      contentHtml: file.contentHtml,
      contentRaw: file.parsed.content,
      path: file.metadata.relativePath,
      tags: file.parsed.tags,
      lastModified: fileMtime,
    })

    const chunks = chunkContent(file.parsed.content)
    if (chunks.length > 0) {
      insertChunksRaw(db, docId, chunks)
    }

    docInfos.push({
      slug: file.metadata.slug,
      title: file.parsed.title,
      section: file.metadata.section,
      sortOrder: file.metadata.sortOrder,
      parentSlug: file.metadata.parentSlug,
      level: file.level,
    })
  }

  const navNodes = buildNavigation(docInfos)
  insertNavigationRaw(db, collection.id, navNodes)
  console.log(`  Built navigation tree: ${navNodes.length} nodes`)
}

/**
 * Check whether the database is newer than all source files and config.
 * Returns true if the build can be skipped.
 */
function isDatabaseFresh(): boolean {
  if (!existsSync(DB_PATH)) return false

  const dbMtime = statSync(DB_PATH).mtimeMs

  // Check config file
  if (existsSync(CONFIG_PATH) && statSync(CONFIG_PATH).mtimeMs > dbMtime) {
    return false
  }

  // Check all source markdown files
  for (const collection of config.collections) {
    if (!existsSync(collection.source)) continue

    const files = findMarkdownFiles(collection.source)
    for (const filePath of files) {
      if (statSync(filePath).mtimeMs > dbMtime) {
        return false
      }
    }
  }

  return true
}

/** Parse CLI arguments for sidecar mode. Returns null if not in CLI mode. */
function parseCliArgs(): { source: string; output: string; collectionId: string; collectionName: string; collectionIcon: string } | null {
  const args = process.argv.slice(2)
  const sourceIdx = args.indexOf('--source')
  if (sourceIdx === -1) return null

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag)
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined
  }

  const source = get('--source')
  const output = get('--output')
  const collectionId = get('--collection-id')
  const collectionName = get('--collection-name')
  const collectionIcon = get('--collection-icon') ?? 'document'

  if (!source || !output || !collectionId || !collectionName) {
    console.error('CLI mode requires: --source, --output, --collection-id, --collection-name')
    process.exit(1)
  }

  return { source, output, collectionId, collectionName, collectionIcon }
}

async function main() {
  const cliArgs = parseCliArgs()

  if (cliArgs) {
    // CLI/sidecar mode: build a single collection from CLI arguments
    console.log('dalil — Building project database (CLI mode)\n')
    console.log(`Source: ${cliArgs.source}`)
    console.log(`Database: ${cliArgs.output}`)

    const collection: Collection = {
      id: cliArgs.collectionId,
      name: cliArgs.collectionName,
      icon: cliArgs.collectionIcon,
      source: cliArgs.source,
    }

    const db = createDatabase(cliArgs.output)

    try {
      db.exec('BEGIN')
      try {
        await processCollection(collection, 0, db)
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
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

    return
  }

  // Config mode: existing behaviour using dalil.config.ts
  const forceFlag = process.argv.includes('--force')

  if (!forceFlag && isDatabaseFresh()) {
    console.log('dalil — Handbook database is up to date, skipping build')
    return
  }

  console.log('dalil — Building handbook database\n')
  console.log(`Database: ${DB_PATH}`)
  console.log(`Collections: ${config.collections.length}`)

  const db = createDatabase(DB_PATH)

  try {
    db.exec('BEGIN')
    try {
      for (let i = 0; i < config.collections.length; i++) {
        await processCollection(config.collections[i], i, db)
      }
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
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
