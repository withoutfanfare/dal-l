use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// A single collection within a project (maps to the existing Collection concept)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCollection {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub source_subpath: String,
}

/// A registered project — either the built-in handbook or a user-added project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub built_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub db_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_built: Option<String>,
    #[serde(default)]
    pub collections: Vec<ProjectCollection>,
}

/// Persisted project registry (saved to projects.json via Tauri store)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRegistry {
    pub projects: Vec<Project>,
    pub active_project_id: String,
}

impl Default for ProjectRegistry {
    fn default() -> Self {
        Self {
            projects: vec![Project {
                id: "engineering-handbook".to_string(),
                name: "Engineering Handbook".to_string(),
                icon: "book".to_string(),
                built_in: true,
                source_path: None,
                db_path: None,
                last_built: None,
                collections: vec![],
            }],
            active_project_id: "engineering-handbook".to_string(),
        }
    }
}

/// Runtime state managing multiple project database connections
pub struct ProjectManager {
    /// Open database connections keyed by project ID
    pub connections: HashMap<String, Connection>,
    /// Project registry (persisted to projects.json)
    pub registry: ProjectRegistry,
}

impl ProjectManager {
    pub fn new(registry: ProjectRegistry) -> Self {
        Self {
            connections: HashMap::new(),
            registry,
        }
    }

    /// Get a reference to the active project's database connection
    pub fn active_connection(&self) -> Result<&Connection, String> {
        self.connections
            .get(&self.registry.active_project_id)
            .ok_or_else(|| {
                format!(
                    "No database connection for active project '{}'",
                    self.registry.active_project_id
                )
            })
    }

    /// Get a reference to a specific project's connection.
    pub fn connection(&self, project_id: &str) -> Result<&Connection, String> {
        self.connections
            .get(project_id)
            .ok_or_else(|| format!("No database connection for project '{}'", project_id))
    }

    /// Open a database connection for a project
    pub fn open_connection(
        &mut self,
        project_id: &str,
        db_path: &std::path::Path,
    ) -> Result<(), String> {
        let conn = Connection::open_with_flags(
            db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(|e| {
            format!(
                "Failed to open database for project '{}': {}",
                project_id, e
            )
        })?;

        self.connections.insert(project_id.to_string(), conn);
        Ok(())
    }

    /// Close a project's database connection
    pub fn close_connection(&mut self, project_id: &str) {
        self.connections.remove(project_id);
    }

    /// Set the active project
    pub fn set_active_project(&mut self, project_id: &str) -> Result<(), String> {
        if !self.registry.projects.iter().any(|p| p.id == project_id) {
            return Err(format!("Project '{}' not found in registry", project_id));
        }
        if !self.connections.contains_key(project_id) {
            return Err(format!(
                "No database connection for project '{}'",
                project_id
            ));
        }
        self.registry.active_project_id = project_id.to_string();
        Ok(())
    }

    /// Add a project to the registry
    pub fn add_project(&mut self, project: Project) {
        self.registry.projects.push(project);
    }

    /// Remove a project from the registry (cannot remove built-in projects)
    pub fn remove_project(&mut self, project_id: &str) -> Result<(), String> {
        if let Some(project) = self.registry.projects.iter().find(|p| p.id == project_id) {
            if project.built_in {
                return Err("Cannot remove built-in project".to_string());
            }
        } else {
            return Err(format!("Project '{}' not found", project_id));
        }

        self.close_connection(project_id);
        self.registry.projects.retain(|p| p.id != project_id);

        // If the removed project was active, switch to the first available
        if self.registry.active_project_id == project_id {
            self.registry.active_project_id = self
                .registry
                .projects
                .first()
                .map(|p| p.id.clone())
                .unwrap_or_default();
        }

        Ok(())
    }
}

const PROJECTS_STORE_FILE: &str = "projects.json";
const PROJECTS_KEY: &str = "projects";

/// Load the project registry from the Tauri store.
/// Returns the default registry (with just the Engineering Handbook) if none exists.
pub fn load_registry(app: &AppHandle) -> Result<ProjectRegistry, String> {
    let store = app.store(PROJECTS_STORE_FILE).map_err(|e| e.to_string())?;

    match store.get(PROJECTS_KEY) {
        Some(value) => {
            serde_json::from_value::<ProjectRegistry>(value.clone()).map_err(|e| e.to_string())
        }
        None => Ok(ProjectRegistry::default()),
    }
}

/// Save the project registry to the Tauri store.
pub fn save_registry(app: &AppHandle, registry: &ProjectRegistry) -> Result<(), String> {
    let store = app.store(PROJECTS_STORE_FILE).map_err(|e| e.to_string())?;
    let value = serde_json::to_value(registry).map_err(|e| e.to_string())?;
    store.set(PROJECTS_KEY, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
