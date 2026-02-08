mod ai;
mod commands;
mod db;
mod models;
mod settings;

use db::{init_db, DbState, HttpClient};
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
        .setup(|app| {
            #[cfg(target_os = "macos")]
            set_dock_icon();

            let conn = init_db(app.handle());
            app.manage(DbState(std::sync::Mutex::new(conn)));

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
