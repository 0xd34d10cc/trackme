#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    let exit = CustomMenuItem::new("exit".to_string(), "Exit");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(exit);

    let tray = SystemTray::new().with_menu(tray_menu);
    tauri::Builder::default()
        .system_tray(tray)
        .on_system_tray_event(|app, event| {
            let create_main_window = || {
                let status = tauri::WindowBuilder::new(app, "main", tauri::WindowUrl::App("index.html".into()))
                    // TODO: get title from config
                    .title("Trackme UI")
                    .build();
                match status {
                    Ok(_) => {},
                    Err(tauri::Error::WindowLabelAlreadyExists(_)) => {
                        if let Some(window) = app.get_window("main") {
                            let _ = window.set_focus();
                        }
                    },
                    Err(e) => panic!("Ooopsie: {}", e),
                }

            };
            match event {
                SystemTrayEvent::MenuItemClick { id, .. } => {
                    match id.as_str() {
                        "exit" => {
                            app.exit(0);
                        }
                        "show" => {
                            create_main_window();
                        }
                        _ => {}
                    }
                }
                SystemTrayEvent::DoubleClick { .. } => {
                    create_main_window();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        // NOTE: a way to continue running app after the last window has been closed
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        });
}
