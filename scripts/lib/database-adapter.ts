/**
 * Database adapter — provides a unified interface over better-sqlite3 (Node)
 * and bun:sqlite (Bun compiled binary).
 *
 * The public surface matches the better-sqlite3 API used by the build scripts:
 * .prepare(), .exec(), .pragma(), .transaction(), .close()
 * Statement: .run(), .get(), .all()
 */

import { createRequire } from 'node:module'

const IS_BUN = typeof globalThis.Bun !== 'undefined'

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface Statement {
  run(...params: unknown[]): RunResult
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface DatabaseInstance {
  prepare(sql: string): Statement
  exec(sql: string): void
  pragma(pragma: string): unknown
  transaction<T extends (...args: any[]) => any>(fn: T): T
  close(): void
}

// Lazily resolved bun:sqlite Database constructor.
// Populated by initBunSqlite() which MUST be called before openDatabase() in Bun environments.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let BunDatabase: any = null

/**
 * Initialise the bun:sqlite module. Must be called once (and awaited) before
 * any openDatabase() call when running under Bun.
 */
export async function initBunSqlite(): Promise<void> {
  if (!IS_BUN || BunDatabase) return
  const mod = await import('bun:sqlite')
  BunDatabase = mod.Database
}

function openBunDatabase(filepath: string): DatabaseInstance {
  if (!BunDatabase) {
    throw new Error('bun:sqlite not initialised — call await initBunSqlite() first')
  }
  const db = new BunDatabase(filepath, { create: true })

  return {
    prepare(sql: string): Statement {
      const stmt = db.prepare(sql)
      return {
        run(...params: unknown[]): RunResult {
          // bun:sqlite's stmt.run() returns { changes, lastInsertRowid } directly.
          const result = stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint }
          return {
            changes: result.changes ?? 0,
            lastInsertRowid: result.lastInsertRowid ?? 0,
          }
        },
        get(...params: unknown[]): unknown {
          return stmt.get(...params)
        },
        all(...params: unknown[]): unknown[] {
          return stmt.all(...params)
        },
      }
    },
    exec(sql: string): void {
      db.exec(sql)
    },
    pragma(pragma: string): unknown {
      return db.exec(`PRAGMA ${pragma}`)
    },
    transaction<T extends (...args: any[]) => any>(fn: T): T {
      return db.transaction(fn) as T
    },
    close(): void {
      db.close()
    },
  }
}

function openBetterSqlite3Database(filepath: string): DatabaseInstance {
  const require = createRequire(import.meta.url)
  const BetterSqlite3 = require('better-sqlite3')
  const db = new BetterSqlite3(filepath)
  return db as DatabaseInstance
}

export function openDatabase(filepath: string): DatabaseInstance {
  if (IS_BUN) {
    return openBunDatabase(filepath)
  }
  return openBetterSqlite3Database(filepath)
}
