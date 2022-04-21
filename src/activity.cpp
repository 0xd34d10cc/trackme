#include "activity.hpp"
#include "unicode.hpp"

#include <windows.h>
#include <psapi.h>
#include <winuser.h>

#include <array>
#include <cassert>


Activity Activity::current() {
  Activity activity{};

  HWND window_handle = GetForegroundWindow();
  if (!window_handle) {
    return activity;
  }

  static const int buffer_size = 256;
  std::array<wchar_t, buffer_size> buffer;
  int n = GetWindowTextW(window_handle, buffer.data(), buffer_size);
  activity.title = utf8_encode(buffer.data(), n);

  DWORD process_id = 0;
  GetWindowThreadProcessId(window_handle, &process_id);
  activity.pid = process_id;

  HANDLE process_handle =
      OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);

  if (process_handle) {
    n = GetProcessImageFileNameW(process_handle, buffer.data(), buffer_size);
    CloseHandle(process_handle);
    activity.executable = utf8_encode(buffer.data(), n);
  }

  return activity;
}

Duration idle_time() {
  LASTINPUTINFO last_input;
  last_input.cbSize = sizeof(LASTINPUTINFO);
  if (!GetLastInputInfo(&last_input)) {
    assert(false);
    return Duration();
  }

  const auto now = GetTickCount();
  const auto elapsed = now - last_input.dwTime;
  return elapsed > 0 ? Milliseconds(elapsed) : Duration();
}
