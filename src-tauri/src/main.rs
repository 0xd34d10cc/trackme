#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context};
use arc_swap::ArcSwap;
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

fn create_main_window(app: &AppHandle) {
    let status = tauri::WindowBuilder::new(app, "main", tauri::WindowUrl::App("index.html".into()))
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
}

fn create_tray(app: tauri::AppHandle) -> SystemTray {
    let exit = CustomMenuItem::new("exit".to_string(), "Exit");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let tray_menu = SystemTrayMenu::new().add_item(show).add_item(exit);

    SystemTray::new()
        .with_menu(tray_menu)
        .on_event(move |event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "exit" => {
                    app.exit(0);
                }
                "show" => {
                    create_main_window(&app);
                }
                _ => {}
            },
            SystemTrayEvent::DoubleClick { .. } => {
                create_main_window(&app);
            }
            _ => {}
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
    let location = match description.location {
        Some(location) => PathBuf::from(location),
        None => base_dir()?.join("data.db"),
    };

    use crate::storage::sqlite;
    let storage = sqlite::Storage::open(location)?;
    Ok(Arc::new(storage))
}

fn init_state(app: &AppHandle) -> anyhow::Result<()> {
    let base_dir = base_dir().context("base dir")?;
    let config = parse_config(&base_dir).context("config")?;
    let storage = create_storage(config.storage.clone()).context("storage")?;

    app.manage(storage);
    app.manage(ArcSwap::from_pointee(config));
    Ok(())
}

async fn run_tracker(handle: AppHandle) -> anyhow::Result<()> {
    let storage = handle.state::<Arc<dyn Storage>>().inner().clone();
    let mut tracker = Tracker::new(storage, handle)?;
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

async fn do_duration_by_exe(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> anyhow::Result<Vec<(String, i64)>> {
    let from = parse_timestamp(from)?;
    let to = parse_timestamp(to)?;
    let durations = storage.duration_by_exe(from, to).await?;
    let durations = durations
        .into_iter()
        .map(|(exe, duration)| (exe, duration.as_millis() as i64))
        .collect();
    Ok(durations)
}

#[tauri::command]
async fn duration_by_exe(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> Result<Vec<(String, i64)>, String> {
    match do_duration_by_exe(from, to, storage).await {
        Ok(durations) => Ok(durations),
        Err(e) => Err(dbg!(e.to_string())),
    }
}

#[tauri::command]
fn get_config(config: State<'_, ArcSwap<Config>>) -> Arc<Config> {
    config.load_full()
}

#[tauri::command]
fn set_config(new: Config, old: State<'_, ArcSwap<Config>>) {
    old.swap(Arc::new(new));
}

fn main() {
    let minimized = std::env::args().any(|arg| arg == "--minimized");

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            create_tray(handle).build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select,
            active_dates,
            duration_by_exe,
            get_config,
            set_config,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |app, event| match event {
            tauri::RunEvent::Ready => {
                if !minimized {
                    create_main_window(app);
                }

                let handle = app.clone();
                // initialize global state
                match init_state(app) {
                    Err(e) => {
                        use tauri::api::dialog::{
                            MessageDialogBuilder, MessageDialogButtons, MessageDialogKind,
                        };

                        MessageDialogBuilder::new("Startup failed", e.root_cause().to_string())
                            .buttons(MessageDialogButtons::Ok)
                            .kind(MessageDialogKind::Error)
                            .show(move |_| handle.exit(1));
                    }
                    Ok(_) => {
                        // run tracker
                        tauri::async_runtime::spawn(async move {
                            loop {
                                if let Err(e) = run_tracker(handle.clone()).await {
                                    eprintln!("Tracker failed: {}", e);
                                }

                                tokio::time::sleep(Duration::from_secs(5)).await;
                            }
                        });
                    }
                }
            }
            tauri::RunEvent::ExitRequested { api, .. } => {
                // NOTE: this allows to keep the app running after all windows have been closed
                api.prevent_exit();
            }
            _ => {}
        });
}
