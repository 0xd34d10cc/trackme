#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        // NOTE: a way to hide the window to system tray, but it still
        //       consumes GPU & RAM resources
        // .on_window_event(|event| match event.event() {
        //     tauri::WindowEvent::CloseRequested { api, .. } => {
        //         event.window().hide().unwrap();
        //         api.prevent_close();
        //     }
        //     _ => {}
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
