use crate::models::Settings;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "ai_settings";

/// Load settings from the Tauri store.
pub fn load_settings(app: &AppHandle) -> Result<Settings, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    match store.get(SETTINGS_KEY) {
        Some(value) => {
            serde_json::from_value::<Settings>(value.clone()).map_err(|e| e.to_string())
        }
        None => Ok(Settings::default()),
    }
}

/// Save settings to the Tauri store.
pub fn save_settings_to_store(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Return settings with API keys masked for display in the frontend.
pub fn mask_settings(settings: &Settings) -> Settings {
    Settings {
        openai_api_key: settings.openai_api_key.as_ref().map(|k| mask_key(k)),
        anthropic_api_key: settings.anthropic_api_key.as_ref().map(|k| mask_key(k)),
        ollama_base_url: settings.ollama_base_url.clone(),
        preferred_provider: settings.preferred_provider.clone(),
    }
}

fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "*".repeat(key.len());
    }
    let visible = &key[..4];
    format!("{}...{}", visible, &key[key.len() - 4..])
}
