mod ai;
mod commands;
mod db;
mod models;
mod settings;

use db::{init_db, DbState};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let conn = init_db(app.handle());
            app.manage(DbState(std::sync::Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_collections,
            commands::get_navigation,
            commands::get_document,
            commands::search_documents,
            commands::get_tags,
            commands::get_similar_chunks,
            commands::get_settings,
            commands::save_settings,
            commands::test_provider,
            commands::ask_question,
            commands::get_embedding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
