mod commands;
mod overlay;

use overlay::{create_overlay_channel, start_overlay_server, OverlayState};
use std::sync::Arc;

const OVERLAY_PORT: u16 = 9898;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, _rx) = create_overlay_channel();
    let state = OverlayState::new(tx, OVERLAY_PORT);
    let state_server = Arc::clone(&state);

    tauri::Builder::default()
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            tauri::async_runtime::spawn(async move {
                start_overlay_server(state_server).await;
            });

            Ok(())
        })
        .manage(state)
        .manage(OVERLAY_PORT)
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::update_overlay,
            commands::get_overlay_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
