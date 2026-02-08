use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState(pub Mutex<Connection>);

pub fn init_db(app: &AppHandle) -> Connection {
    let db_path = if cfg!(debug_assertions) {
        // In dev mode, dalil.db is in the project root (parent of src-tauri/)
        let mut path = std::env::current_dir().unwrap();
        if path.ends_with("src-tauri") {
            path.pop();
        }
        path.push("dalil.db");
        path
    } else {
        app.path()
            .resource_dir()
            .expect("Failed to resolve resource directory")
            .join("dalil.db")
    };

    Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .unwrap_or_else(|e| panic!("Failed to open database at {:?}: {}", db_path, e))
}
