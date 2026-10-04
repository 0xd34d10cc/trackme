#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context};
use arc_swap::ArcSwap;
use chrono::{DateTime, NaiveDateTime};
use storage::Storage;
use tauri::menu::{Menu, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};

mod activity;
mod analytics;
mod config;
mod idle;
mod storage;
mod tagger;
mod tracker;

use config::{Config, StorageDescription};
use tracker::Tracker;

use crate::analytics::DailyUsage;

use crate::activity::Entry as ActivityEntry;

fn create_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
        return;
    }

    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
        .title("Trackme")
        .focused(true)
        .maximized(true)
        .build()
        .expect("Failed to create window");
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let exit = MenuItemBuilder::with_id("exit", "Exit").build(app)?;
    let menu = Menu::with_items(app, &[&show, &exit])?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu)
        // reserve left click for restoring the window, as double click does below
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "exit" => {
                app.exit(0);
            }
            "show" => {
                create_main_window(app);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                create_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
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
        None => base_dir()?.join("data.duckdb"),
    };

    use crate::storage::duckdb;
    let storage = duckdb::Storage::open(location)?;
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
    let time = DateTime::from_timestamp_millis(timestamp)
        .map(|time| time.naive_utc())
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

async fn do_usage_daily(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> anyhow::Result<Vec<DailyUsage>> {
    // An empty or inverted range has no rows; skip the round trip to DuckDB.
    if to <= from {
        return Ok(Vec::new());
    }
    let from = parse_timestamp(from)?;
    let to = parse_timestamp(to)?;
    storage.usage_daily(from, to).await
}

#[tauri::command]
async fn usage_daily(
    from: i64,
    to: i64,
    storage: State<'_, Arc<dyn Storage>>,
) -> Result<Vec<DailyUsage>, String> {
    match do_usage_daily(from, to, storage).await {
        Ok(rows) => Ok(rows),
        Err(e) => Err(format!("{}", e)),
    }
}

#[tauri::command]
async fn active_dates(storage: State<'_, Arc<dyn Storage>>) -> Result<Vec<i64>, String> {
    match storage.active_dates().await {
        Ok(dates) => Ok(dates
            .into_iter()
            .map(|date| date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp_millis())
            .collect()),
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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            create_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select,
            active_dates,
            usage_daily,
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
                        use tauri_plugin_dialog::{
                            DialogExt, MessageDialogButtons, MessageDialogKind,
                        };

                        app.dialog()
                            .message(e.root_cause().to_string())
                            .title("Startup failed")
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
            tauri::RunEvent::ExitRequested { api, code, .. } => {
                // Keep running after the last window is closed (tracking
                // continues in the tray), but honour an explicit exit:
                // AppHandle::exit(code) also routes through this event with
                // `code` set, and must not be cancelled.
                if code.is_none() {
                    api.prevent_exit();
                }
            }
            _ => {}
        });
}
