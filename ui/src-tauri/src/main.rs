#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};

use anyhow::anyhow;
use storage::Storage;
use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};

mod activity;
mod config;
mod tracker;
mod storage;
mod tagger;

use config::Config;
use tracker::Tracker;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn create_tray(app: tauri::AppHandle) -> SystemTray {
    let exit = CustomMenuItem::new("exit".to_string(), "Exit");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let tray_menu = SystemTrayMenu::new().add_item(show).add_item(exit);

    SystemTray::new()
        .with_menu(tray_menu)
        .on_event(move |event| {
            let create_main_window = || {
                let status = tauri::WindowBuilder::new(
                    &app,
                    "main",
                    tauri::WindowUrl::App("index.html".into()),
                )
                // TODO: get title from config
                .title("Trackme UI")
                .build();
                match status {
                    Ok(_) => {}
                    Err(tauri::Error::WindowLabelAlreadyExists(_)) => {
                        if let Some(window) = app.get_window("main") {
                            let _ = window.set_focus();
                        }
                    }
                    Err(e) => panic!("Failed to create window: {}", e),
                }
            };
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                    "exit" => {
                        app.exit(0);
                    }
                    "show" => {
                        create_main_window();
                    }
                    _ => {}
                },
                SystemTrayEvent::DoubleClick { .. } => {
                    create_main_window();
                }
                _ => {}
            }
        })
}

fn base_dir() -> anyhow::Result<PathBuf> {
    // TODO: make base_dir configurable via command line parameter
    let base_dir = dirs::home_dir().ok_or_else(|| anyhow!("HOME is not set"))?;
    let base_dir = base_dir.join("trackme");
    #[cfg(debug_assertions)]
    let base_dir = base_dir.join("debug");
    if !base_dir.exists() {
        std::fs::create_dir_all(&base_dir)?;
    }
    Ok(base_dir)
}

fn parse_config(base_dir: &Path) -> anyhow::Result<Config> {
    let filename = base_dir.join("config.json");
    let config = match std::fs::read_to_string(filename) {
        Ok(config) => config,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // TODO: log
            return Ok(Config::default());
        }
        Err(e) => return Err(e.into()),
    };

    let config: Config = serde_json::from_str(&config)?;
    Ok(config)
}

fn create_storage(dir: PathBuf) -> anyhow::Result<Box<dyn Storage>> {
    use crate::storage::csv;
    let storage = csv::Storage::open(dir)?;
    Ok(Box::new(storage))
}

async fn run_tracker() -> anyhow::Result<()> {
    let base_dir = base_dir()?;
    let config = parse_config(&base_dir)?;
    let storage = create_storage(base_dir)?;
    let tracker = Tracker::new(storage, config)?;
    tracker.run().await?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            create_tray(handle).build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::Ready => {
                tauri::async_runtime::spawn(async {
                    use std::time::Duration;

                    loop {
                        if let Err(e) = run_tracker().await {
                            eprintln!("Tracker failed: {}", e);
                        }

                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                });
            }
            tauri::RunEvent::ExitRequested { api, .. } => {
                // NOTE: this allows to keep the app running after all windows have been closed
                api.prevent_exit();
            }
            _ => {}
        });
}
