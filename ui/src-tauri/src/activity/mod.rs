use std::cmp::{PartialEq, Eq};

use serde::{Deserialize, Serialize};

mod writer;
pub mod matcher;

pub use writer::Writer;

type ProcessID = u32;

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Activity {
    pub pid: ProcessID,
    pub exe: String,
    pub title: String,
}

impl Activity {
    pub fn current() -> Option<Activity> {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::ProcessStatus::K32GetProcessImageFileNameW;
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        };

        unsafe {
            let window = GetForegroundWindow();
            if window.0 == 0 {
                return None;
            }

            let mut pid: ProcessID = 0;
            GetWindowThreadProcessId(window, Some(&mut pid));
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
            let mut buffer = [0u16; 1024];
            let n = K32GetProcessImageFileNameW(process, &mut buffer) as usize;
            CloseHandle(process);

            let exe = String::from_utf16_lossy(&buffer[..n]);

            let n = GetWindowTextW(window, &mut buffer) as usize;
            let title = String::from_utf16_lossy(&buffer[..n]);

            Some(Activity { pid, exe, title })
        }
    }
}
