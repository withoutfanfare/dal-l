use crate::models::{AppPreferences, Settings};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "ai_settings";
const PREFERENCES_KEY: &str = "app_preferences";

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
        anthropic_model: settings.anthropic_model.clone(),
    }
}

pub fn load_preferences(app: &AppHandle) -> Result<AppPreferences, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;

    match store.get(PREFERENCES_KEY) {
        Some(value) => {
            serde_json::from_value::<AppPreferences>(value.clone()).map_err(|e| e.to_string())
        }
        None => Ok(AppPreferences::default()),
    }
}

pub fn save_preferences_to_store(
    app: &AppHandle,
    preferences: &AppPreferences,
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(preferences).map_err(|e| e.to_string())?;
    store.set(PREFERENCES_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn mask_key(key: &str) -> String {
    let char_count = key.chars().count();
    if char_count <= 8 {
        return "*".repeat(char_count);
    }
    let prefix: String = key.chars().take(4).collect();
    let suffix: String = key.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect();
    format!("{}...{}", prefix, suffix)
}
