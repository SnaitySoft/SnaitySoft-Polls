mod commands;
pub mod env_crypto;
mod oauth;
mod overlay;
mod youtube_scrape;

use overlay::{create_overlay_channel, start_overlay_server, OverlayState};
use std::sync::Arc;
use tauri::Manager;

const OVERLAY_PORT: u16 = 9898;

const LOG_TIME_FORMAT: &[time::format_description::FormatItem] =
    time::macros::format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, _rx) = create_overlay_channel();
    let state = OverlayState::new(tx, OVERLAY_PORT);
    let state_server = Arc::clone(&state);

    tauri::Builder::default()
        .setup(move |app| {
            // Registered unconditionally (not just debug builds) so a release build run by
            // someone else still leaves a log file to send us when something goes wrong —
            // that's the whole point, since we can't see their console. Stdout/Webview are
            // just a convenience for dev; LogDir is the one that matters for bug reports.
            // Builder::new() is NOT empty — it already seeds Stdout + a default-named LogDir
            // target, so chaining .target() on top just appends to those instead of replacing
            // them (produced two log files in practice: the default-named one and ours).
            // .targets([...]) replaces the list outright.
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    .level(log::LevelFilter::Info)
                    // Default target for webview-forwarded logs is the JS call site inside
                    // attachConsoleLog.ts (a bundled/hashed chunk URL+line) — meaningless to a
                    // human and different on every build. Collapse it to a flat "webview" tag;
                    // Rust-originated logs keep their real module path (e.g. app_lib::overlay).
                    .format(|out, message, record| {
                        let target = record.target();
                        let target = if target.starts_with("webview") { "webview" } else { target };
                        let ts = time::OffsetDateTime::now_utc()
                            .format(LOG_TIME_FORMAT)
                            .unwrap_or_default();
                        out.finish(format_args!("{ts} [{}] [{target}] {message}", record.level()))
                    })
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: Some("snaitysoft-polls".to_string()),
                        }),
                    ])
                    // Fresh log file every launch (easy to find "what happened last session"),
                    // but the previous 4 get kept too (renamed with a timestamp) instead of
                    // being deleted outright — so troubleshooting still has history to look at.
                    .file_open_strategy(tauri_plugin_log::FileOpenStrategy::Rotate)
                    .max_file_size(5_000_000)
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                    .build(),
            )?;

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
            commands::open_log_folder,
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
