use std::sync::Arc;
use tauri::State;
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
