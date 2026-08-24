use std::sync::Arc;
use tauri::{Manager, State};
use tauri_plugin_opener::OpenerExt;
use crate::overlay::OverlayState;

#[tauri::command]
pub async fn update_overlay(state: State<'_, Arc<OverlayState>>, json: String) -> Result<(), ()> {
    state.broadcast(json).await;
    Ok(())
}

#[tauri::command]
pub fn get_overlay_port(port: State<'_, u16>) -> u16 {
    *port
}

/// Reveals the log directory in the OS file explorer — the log file itself (see lib.rs's
/// tauri_plugin_log setup) is what a user sends us when something fails and we can't see
/// their console, so this needs to be one click away, not "go find your AppData folder".
#[tauri::command]
pub fn open_log_folder(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}
