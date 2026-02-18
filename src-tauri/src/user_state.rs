use rusqlite::Connection;
use tauri::{AppHandle, Manager};

pub struct UserStateDb(pub std::sync::Mutex<Connection>);

pub fn init_user_state_db(app: &AppHandle) -> Result<Connection, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    let db_path = app_data_dir.join("user_state.db");

    let conn = Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
            | rusqlite::OpenFlags::SQLITE_OPEN_CREATE
            | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open user state DB at {:?}: {}", db_path, e))?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            collection_id TEXT NOT NULL,
            doc_slug TEXT NOT NULL,
            anchor_id TEXT,
            title_snapshot TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_opened_at INTEGER,
            order_index INTEGER NOT NULL DEFAULT 0,
            is_favorite INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS bookmark_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmark_folder_items (
            folder_id INTEGER NOT NULL,
            bookmark_id INTEGER NOT NULL,
            PRIMARY KEY(folder_id, bookmark_id),
            FOREIGN KEY(folder_id) REFERENCES bookmark_folders(id) ON DELETE CASCADE,
            FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bookmark_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmark_tag_items (
            tag_id INTEGER NOT NULL,
            bookmark_id INTEGER NOT NULL,
            PRIMARY KEY(tag_id, bookmark_id),
            FOREIGN KEY(tag_id) REFERENCES bookmark_tags(id) ON DELETE CASCADE,
            FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bookmark_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookmark_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS doc_views (
            project_id TEXT NOT NULL,
            doc_slug TEXT NOT NULL,
            last_viewed_at INTEGER NOT NULL,
            PRIMARY KEY(project_id, doc_slug)
        );

        CREATE TABLE IF NOT EXISTS doc_notes (
            project_id TEXT NOT NULL,
            doc_slug TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(project_id, doc_slug)
        );

        CREATE TABLE IF NOT EXISTS doc_highlights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            doc_slug TEXT NOT NULL,
            anchor_id TEXT,
            selected_text TEXT NOT NULL,
            context_text TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_change_feed (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            author TEXT NOT NULL,
            committed_at TEXT NOT NULL,
            changed_files_json TEXT NOT NULL,
            changed_doc_slugs_json TEXT NOT NULL,
            recorded_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bookmarks_project_updated
            ON bookmarks(project_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_project_doc_anchor
            ON bookmarks(project_id, doc_slug, anchor_id);
        CREATE INDEX IF NOT EXISTS idx_bookmarks_project_title
            ON bookmarks(project_id, title_snapshot);
        CREATE INDEX IF NOT EXISTS idx_doc_views_project_last_viewed
            ON doc_views(project_id, last_viewed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_doc_notes_project_doc
            ON doc_notes(project_id, doc_slug);
        CREATE INDEX IF NOT EXISTS idx_doc_highlights_project_doc
            ON doc_highlights(project_id, doc_slug, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_change_feed_project_recorded
            ON project_change_feed(project_id, recorded_at DESC);
        ",
    )
    .map_err(|e| format!("Failed to initialise user state DB schema: {}", e))?;

    // Backward-compatible migration for installs created before bookmark favourites existed.
    let has_favorite_column: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('bookmarks') WHERE name = 'is_favorite'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to inspect bookmarks schema: {}", e))?;
    if has_favorite_column == 0 {
        conn.execute(
            "ALTER TABLE bookmarks ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|e| format!("Failed to add bookmarks.is_favorite column: {}", e))?;
    }

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_bookmarks_project_favorite
         ON bookmarks(project_id, is_favorite DESC, updated_at DESC)",
        [],
    )
    .map_err(|e| format!("Failed to create bookmarks favourite index: {}", e))?;

    Ok(conn)
}
