use rusqlite::Connection;
use tauri::{AppHandle, Manager};

/// Shared reqwest HTTP client, built once at startup and reused for all requests.
pub struct HttpClient(pub reqwest::Client);

/// Resolve the path to the built-in handbook database.
///
/// In dev mode, uses CARGO_MANIFEST_DIR (set at compile time) to reliably locate
/// the project root regardless of the working directory the app is launched from.
/// In release mode, reads from the Tauri resource bundle.
pub fn handbook_db_path(app: &AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        // CARGO_MANIFEST_DIR points to src-tauri/ at compile time — parent is project root.
        let project_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("CARGO_MANIFEST_DIR has no parent directory");
        project_root.join("dalil.db")
    } else {
        app.path()
            .resource_dir()
            .expect("Failed to resolve resource directory — ensure the app bundle is intact and has not been moved from a valid installation path")
            .join("dalil.db")
    }
}

pub fn init_db(app: &AppHandle) -> Connection {
    let db_path = handbook_db_path(app);

    // SAFETY: SQLITE_OPEN_NO_MUTEX disables SQLite's internal thread safety.
    // All access MUST go through the Rust Mutex wrapper.
    // rusqlite::Connection is not Sync so Mutex is required over RwLock.
    Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .unwrap_or_else(|e| panic!("Failed to open database at {:?}: {}", db_path, e))
}
