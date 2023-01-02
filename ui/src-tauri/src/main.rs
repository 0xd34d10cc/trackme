#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};

mod activity;
mod tracker;

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

async fn run_tracker() -> anyhow::Result<()> {
    let tracker = Tracker::new()?;
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
                    if let Err(e) = run_tracker().await {
                        eprintln!("Tracker faield: {}", e);
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
