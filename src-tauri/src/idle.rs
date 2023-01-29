use std::time::Duration;

pub fn time() -> Duration {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    let mut info = LASTINPUTINFO::default();
    info.cbSize = std::mem::size_of_val(&info) as u32;
    unsafe {
        if GetLastInputInfo(&mut info).0 == 0 {
            return Duration::from_millis(0);
        }

        let now = GetTickCount();
        let elapsed = now - info.dwTime;
        Duration::from_millis(elapsed as u64)
    }
}
