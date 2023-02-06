#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::anyhow;
use chrono::NaiveDateTime;
use storage::Storage;
use tauri::{
    AppHandle, CustomMenuItem, Manager, State, SystemTray, SystemTrayEvent, SystemTrayMenu,
};

mod activity;
mod config;
mod idle;
mod storage;
mod tagger;
mod tracker;

use config::{Config, StorageDescription};
use tracker::Tracker;

use crate::activity::Entry as ActivityEntry;
use crate::config::StorageKind;

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
                .title("Trackme")
                .focused(true)
                .maximized(true)
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
        // TODO: create default config
        // Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
        //     // TODO: log
        //     return Ok(Config::default());
        // }
        Err(e) => return Err(e.into()),
    };

    let config: Config = serde_json::from_str(&config)?;
    Ok(config)
}

fn create_storage(description: StorageDescription) -> anyhow::Result<Arc<dyn Storage>> {
    match description.kind {
        StorageKind::Csv => {
            use crate::storage::csv;
            let location = match description.location {
                Some(location) => PathBuf::from(location),
                None => base_dir()?,
            };
            let storage = csv::Storage::open(location)?;
            Ok(Arc::new(storage))
        }
        StorageKind::Sqlite => {
            let location = match description.location {
                Some(location) => PathBuf::from(location),
                None => base_dir()?.join("data.db"),
            };

            use crate::storage::sqlite;
            let storage = sqlite::Storage::open(location)?;
            Ok(Arc::new(storage))
        }
    }
}

async fn run_tracker(app: AppHandle) -> anyhow::Result<()> {
    let base_dir = base_dir()?;
    let config = parse_config(&base_dir)?;
    let storage = create_storage(config.storage)?;
    // TODO: check whether it panics on second call
    app.manage(storage.clone());
    let tracker = Tracker::new(storage, config.blacklist, config.tagger)?;
    tracker.run().await?;
    Ok(())
}

fn parse_timestamp(timestamp: i64) -> anyhow::Result<NaiveDateTime> {
    let time = NaiveDateTime::from_timestamp_millis(timestamp)
        .ok_or_else(|| anyhow!("Invalid timestamp: {}", timestamp))?;
    Ok(time)
}

async fn do_select(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> anyhow::Result<Vec<ActivityEntry>> {
    let from = parse_timestamp(from)?;
    let to = parse_timestamp(to)?;
    let entries = storage.select(from, to).await?;
    Ok(entries)
}

#[tauri::command]
async fn select(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> Result<Vec<ActivityEntry>, String> {
    match do_select(from, to, storage).await {
        Ok(entries) => Ok(entries),
        Err(e) => Err(format!("{}", e)),
    }
}

#[tauri::command]
async fn active_dates(storage: State<'_, Arc<dyn Storage>>) -> Result<Vec<i64>, String> {
    match storage.active_dates().await {
        Ok(dates) => Ok(dates
            .into_iter()
            .map(|date| date.and_hms_opt(0, 0, 0).unwrap().timestamp_millis())
            .collect()),
        Err(e) => Err(dbg!(e.to_string())),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            create_tray(handle).build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![select, active_dates])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Ready => {
                let handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    use std::time::Duration;

                    loop {
                        if let Err(e) = run_tracker(handle.clone()).await {
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
