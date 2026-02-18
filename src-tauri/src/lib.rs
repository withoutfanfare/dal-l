mod ai;
mod commands;
mod db;
mod models;
mod projects;
mod settings;

use db::{init_db, HttpClient};
use projects::{load_registry, ProjectManager};
use tauri::Manager;

#[cfg(target_os = "macos")]
fn set_dock_icon() {
    use objc2::AnyThread;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let icon_bytes = include_bytes!("../icons/128x128@2x.png");
    let data = NSData::with_bytes(icon_bytes);
    if let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) {
        if let Some(mtm) = MainThreadMarker::new() {
            let app = NSApplication::sharedApplication(mtm);
            unsafe { app.setApplicationIconImage(Some(&image)) };
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            set_dock_icon();

            // ProjectManager: manages multiple project DB connections
            let registry = load_registry(app.handle()).unwrap_or_default();
            let mut manager = ProjectManager::new(registry);

            // Open the built-in handbook connection
            let handbook_conn = init_db(app.handle());
            manager.connections.insert("engineering-handbook".to_string(), handbook_conn);

            // Restore connections for user-added projects
            let app_data_dir = app.path().app_data_dir()?;
            let user_projects: Vec<_> = manager.registry.projects.iter()
                .filter(|p| !p.built_in)
                .filter_map(|p| p.db_path.as_ref().map(|db| (p.id.clone(), app_data_dir.join(db))))
                .collect();
            for (id, db_path) in user_projects {
                if db_path.exists() {
                    if let Err(e) = manager.open_connection(&id, &db_path) {
                        eprintln!("Warning: failed to open database for project '{}': {}", id, e);
                    }
                }
            }

            // If the active project has no connection, fall back to the handbook
            if !manager.connections.contains_key(&manager.registry.active_project_id) {
                eprintln!(
                    "Warning: active project '{}' has no database — falling back to engineering-handbook",
                    manager.registry.active_project_id
                );
                manager.registry.active_project_id = "engineering-handbook".to_string();
                let _ = projects::save_registry(app.handle(), &manager.registry);
            }

            app.manage(std::sync::Mutex::new(manager));

            let http_client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client");
            app.manage(HttpClient(http_client));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_collections,
            commands::get_navigation,
            commands::get_document,
            commands::search_documents,
            commands::get_tags,
            commands::get_documents_by_tag,
            commands::get_similar_chunks,
            commands::get_settings,
            commands::save_settings,
            commands::test_provider,
            commands::ask_question,
            commands::get_embedding,
            commands::list_projects,
            commands::get_active_project_id,
            commands::set_active_project,
            commands::add_project,
            commands::rebuild_project,
            commands::remove_project,
            commands::get_project_stats,
            commands::open_in_editor,
            commands::get_preferences,
            commands::save_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
