import Database from 'better-sqlite3'
import { existsSync, unlinkSync } from 'node:fs'

export function createDatabase(dbPath: string): Database.Database {
  if (existsSync(dbPath)) {
    unlinkSync(dbPath)
  }

  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id TEXT NOT NULL REFERENCES collections(id),
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 999,
      parent_slug TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL,
      content_raw TEXT NOT NULL,
      path TEXT NOT NULL
    );

    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE
    );

    CREATE TABLE document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (document_id, tag_id)
    );

    CREATE TABLE navigation_tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id TEXT NOT NULL REFERENCES collections(id),
      slug TEXT NOT NULL,
      parent_slug TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 999,
      level INTEGER NOT NULL DEFAULT 0,
      has_children INTEGER NOT NULL DEFAULT 0
    );

    CREATE VIRTUAL TABLE documents_fts USING fts5(
      title, content, section, collection, tags
    );

    CREATE TABLE chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      chunk_index INTEGER NOT NULL,
      content_text TEXT NOT NULL,
      heading_context TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE chunk_embeddings (
      chunk_id INTEGER NOT NULL REFERENCES chunks(id),
      embedding BLOB
    );

    CREATE VIRTUAL TABLE chunks_fts USING fts5(content_text, heading_context);
  `)

  return db
}

export function insertCollection(
  db: Database.Database,
  collection: {
    id: string
    name: string
    icon: string
    description?: string
    sortOrder: number
  },
): void {
  const stmt = db.prepare(
    'INSERT INTO collections (id, name, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)',
  )
  stmt.run(collection.id, collection.name, collection.icon, collection.description ?? null, collection.sortOrder)
}

export function insertDocument(
  db: Database.Database,
  doc: {
    collectionId: string
    slug: string
    title: string
    section: string
    sortOrder: number
    parentSlug: string
    contentHtml: string
    contentRaw: string
    path: string
    tags: string[]
  },
): number {
  const insertDoc = db.prepare(`
    INSERT INTO documents (collection_id, slug, title, section, sort_order, parent_slug, content_html, content_raw, path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertFts = db.prepare(`
    INSERT INTO documents_fts(rowid, title, content, section, collection, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (tag) VALUES (?)')
  const selectTag = db.prepare('SELECT id FROM tags WHERE tag = ?')
  const insertDocTag = db.prepare('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)')

  const insert = db.transaction(() => {
    const result = insertDoc.run(
      doc.collectionId,
      doc.slug,
      doc.title,
      doc.section,
      doc.sortOrder,
      doc.parentSlug,
      doc.contentHtml,
      doc.contentRaw,
      doc.path,
    )

    const documentId = result.lastInsertRowid as number

    // Insert into FTS index
    const tagString = doc.tags.join(' ')
    insertFts.run(documentId, doc.title, doc.contentRaw, doc.section, doc.collectionId, tagString)

    for (const tag of doc.tags) {
      insertTag.run(tag)
      const row = selectTag.get(tag) as { id: number }
      insertDocTag.run(documentId, row.id)
    }

    return documentId
  })

  return insert()
}

export function insertNavigation(
  db: Database.Database,
  collectionId: string,
  nodes: Array<{
    slug: string
    parentSlug: string
    title: string
    sortOrder: number
    level: number
    hasChildren: boolean
  }>,
): void {
  const stmt = db.prepare(`
    INSERT INTO navigation_tree (collection_id, slug, parent_slug, title, sort_order, level, has_children)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    for (const node of nodes) {
      stmt.run(collectionId, node.slug, node.parentSlug, node.title, node.sortOrder, node.level, node.hasChildren ? 1 : 0)
    }
  })

  insertAll()
}

export function insertChunks(
  db: Database.Database,
  documentId: number,
  chunks: Array<{
    chunkIndex: number
    contentText: string
    headingContext: string
  }>,
): void {
  const stmt = db.prepare(`
    INSERT INTO chunks (document_id, chunk_index, content_text, heading_context)
    VALUES (?, ?, ?, ?)
  `)

  const ftsStmt = db.prepare(`
    INSERT INTO chunks_fts(rowid, content_text, heading_context)
    VALUES (?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    for (const chunk of chunks) {
      const result = stmt.run(documentId, chunk.chunkIndex, chunk.contentText, chunk.headingContext)
      ftsStmt.run(result.lastInsertRowid, chunk.contentText, chunk.headingContext)
    }
  })

  insertAll()
}

