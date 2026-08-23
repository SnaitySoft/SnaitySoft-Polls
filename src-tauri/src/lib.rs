mod commands;
pub mod env_crypto;
mod oauth;
mod overlay;
mod youtube_scrape;

use overlay::{create_overlay_channel, start_overlay_server, OverlayState};
use std::sync::Arc;
use tauri::Manager;

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

            // Bundled .env.enc (release builds, encrypted — see env_crypto.rs and the
            // encrypt_env bin) first, then project-root .env (dev) fills in anything still
            // missing — apply_env_str/dotenvy both skip vars that are already set.
            if let Ok(bundled) = app.path().resolve(".env.enc", tauri::path::BaseDirectory::Resource) {
                if let Ok(data) = std::fs::read(&bundled) {
                    match env_crypto::decrypt(&data) {
                        Ok(content) => env_crypto::apply_env_str(&content),
                        Err(e) => log::error!("falha ao decifrar .env.enc bundled: {e}"),
                    }
                }
            }
            dotenvy::dotenv().ok();

            tauri::async_runtime::spawn(async move {
                start_overlay_server(state_server).await;
            });

            Ok(())
        })
        .manage(state)
        .manage(OVERLAY_PORT)
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::update_overlay,
            commands::get_overlay_port,
            oauth::twitch_oauth_device_start,
            oauth::twitch_oauth_device_poll,
            oauth::twitch_oauth_refresh,
            oauth::kick_oauth_login,
            oauth::kick_oauth_refresh,
            youtube_scrape::youtube_scrape_start,
            youtube_scrape::youtube_scrape_poll,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
