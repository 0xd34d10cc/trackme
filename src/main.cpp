#include "executor.hpp"
#include "matcher.hpp"
#include "notification.hpp"
#include "unicode.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>
#include <psapi.h>
#include <strsafe.h>

#include <array>
#include <atomic>
#include <chrono>
#include <filesystem>
#include <format>
#include <fstream>
#include <iostream>
#include <thread>
#include <utility>

namespace fs = std::filesystem;

static std::string current_active_window() {
  HWND window_handle = GetForegroundWindow();
  if (!window_handle) {
    return std::string{};
  }

  static const int title_size = 256;
  std::array<wchar_t, title_size> title;
  int n = GetWindowTextW(window_handle, title.data(), title_size);
  if (n == 0) {
    DWORD process_id = 0;
    GetWindowThreadProcessId(window_handle, &process_id);
    HANDLE process_handle =
        OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
    if (process_handle) {
      n = GetProcessImageFileNameW(process_handle, title.data(), title_size);
      CloseHandle(process_handle);
    }
  }

#ifdef _DEBUG
  OutputDebugStringW(title.data());
  OutputDebugStringW(L"\n");
#endif

  return utf8_encode(title.data(), n);
}

static bool track(ActivityMatcher& matcher, std::string_view activity,
                  Duration time_active) {
  auto* stats = matcher.match(activity);
  if (!stats) {
    return false;
  }

  const bool limit_exceeded = stats->active > stats->limit;
  stats->active += time_active;

  if (!limit_exceeded && stats->active > stats->limit) {
    show_notification(std::string(activity) + " - time's up");
  }

  return true;
}

static fs::path trackme_dir() {
  if (const char* home = std::getenv("HOME")) {
    return fs::path(home) / "trackme";
  } else if (const char* userprofile = std::getenv("userprofile")) {
    return fs::path(userprofile) / "trackme";
  } else {
    return fs::current_path();
  }
}

static fs::path data_path(Date date) {
  const auto dir = trackme_dir();
  if (!fs::exists(dir) && !fs::create_directories(dir)) {
    std::abort();
  }

  const auto name =
      std::format("{}-{}-{}.json", date.day(), date.month(), date.year());
  return dir / name;
}

static std::unique_ptr<ActivityMatcher> load_data(Date date) {
  auto path = data_path(date);
  if (!fs::exists(path)) {
    return nullptr;
  }

  auto file = std::fstream(path, std::fstream::in | std::fstream::binary);
  Json data;
  file >> data;
  return parse_matcher(data);
}

static void save_data(const ActivityMatcher& matcher, Date date) {
  auto file =
      std::fstream(data_path(date), std::fstream::out | std::fstream::binary);
  file << matcher.to_json().dump(4) << std::flush;
}

#define WM_USER_SHELLICON WM_USER + 1

// Global Variables:
// TODO: find a way to get rid of it
NOTIFYICONDATA nidApp;

static std::atomic<bool> paused = false;

LRESULT CALLBACK on_window_message(HWND hWnd, UINT message, WPARAM wParam,
                                   LPARAM lParam) {
  int wmId, wmEvent;
  POINT lpClickPoint;
  HMENU hPopMenu;

  // static const uint32_t menu_item_id = IDM_EXIT;
  static const uint32_t menu_exit_id = 1337;
  static const uint32_t menu_pause_id = 1338;

  switch (message) {
    case WM_USER_SHELLICON:
      // systray msg callback
      switch (LOWORD(lParam)) {
        case WM_RBUTTONDOWN:
          UINT uFlag = MF_BYPOSITION | MF_STRING;
          GetCursorPos(&lpClickPoint);
          hPopMenu = CreatePopupMenu();
          InsertMenu(hPopMenu, 0xFFFFFFFF, MF_BYPOSITION | MF_STRING,
                     menu_pause_id, paused ? L"Resume" : L"Pause");
          InsertMenu(hPopMenu, 0xFFFFFFFF, MF_BYPOSITION | MF_STRING,
                     menu_exit_id, L"Exit");
          SetForegroundWindow(hWnd);
          TrackPopupMenu(hPopMenu,
                         TPM_LEFTALIGN | TPM_LEFTBUTTON | TPM_BOTTOMALIGN,
                         lpClickPoint.x, lpClickPoint.y, 0, hWnd, NULL);
          return TRUE;
      }
      break;
    case WM_COMMAND:
      wmId = LOWORD(wParam);
      wmEvent = HIWORD(wParam);
      // Parse the menu selections:
      switch (wmId) {
        case menu_exit_id:
          Shell_NotifyIcon(NIM_DELETE, &nidApp);
          DestroyWindow(hWnd);
          break;
        case menu_pause_id:
          paused = !paused;
          break;
        default:
          return DefWindowProc(hWnd, message, wParam, lParam);
      }
      break;
    case WM_DESTROY:
      PostQuitMessage(0);
      break;
    default:
      return DefWindowProc(hWnd, message, wParam, lParam);
  }
  return 0;
}

static void init_win32(HINSTANCE instance) {
  static const wchar_t* title = L"trackme";
  static const wchar_t* class_name = L"trackme_systray";

  WNDCLASSEX wcex;
  wcex.cbSize = sizeof(WNDCLASSEX);

  wcex.style = CS_HREDRAW | CS_VREDRAW;
  wcex.lpfnWndProc = on_window_message;
  wcex.cbClsExtra = 0;
  wcex.cbWndExtra = 0;
  wcex.hInstance = instance;

  wcex.hIcon = LoadIcon(NULL, IDI_APPLICATION);
  wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
  wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
  wcex.lpszMenuName = title;
  wcex.lpszClassName = class_name;
  wcex.hIconSm = LoadIcon(NULL, IDI_APPLICATION);

  RegisterClassEx(&wcex);

  // Perform application initialization:
  HWND hWnd =
      CreateWindow(class_name, title, WS_OVERLAPPEDWINDOW, CW_USEDEFAULT, 0,
                   CW_USEDEFAULT, 0, NULL, NULL, instance, NULL);

  if (!hWnd) {
    abort();
  }

  nidApp.cbSize = sizeof(NOTIFYICONDATA);  // sizeof the struct in bytes
  nidApp.hWnd =
      (HWND)hWnd;  // handle of the window which will process this app. messages
  nidApp.uID = 32512;  // ID of the icon that willl appear in the system tray
  nidApp.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;  // ORing of all the flags
  nidApp.hIcon =
      LoadIcon(NULL, IDI_APPLICATION);  // handle of the Icon to be displayed,
                                        // obtained from LoadIcon
  nidApp.uCallbackMessage = WM_USER_SHELLICON;
  StringCchCopyW(nidApp.szTip, sizeof(nidApp.szTip) / sizeof(nidApp.szTip[0]),
                 title);
  Shell_NotifyIcon(NIM_ADD, &nidApp);
}

static void run_win32_event_loop() {
  bool running = true;
  while (running) {
    const int timeout_ms = 100;
    if (MsgWaitForMultipleObjects(0, NULL, FALSE, (int)timeout_ms,
                                  QS_ALLINPUT) == WAIT_OBJECT_0) {
      MSG msg;
      while (running && PeekMessage(&msg, 0, 0, 0, PM_REMOVE)) {
        if (msg.message == WM_QUIT) {
          running = false;
          break;
        }

        TranslateMessage(&msg);
        DispatchMessage(&msg);
      }
    }
  }
}

int WINAPI WinMain(_In_ HINSTANCE instance,
                   _In_opt_ HINSTANCE /*hPrevInstance*/,
                   _In_ LPSTR /*lpCmdLine*/, _In_ int /*nCmdShow*/
) {
  init_win32(instance);
  init_notifications();

  Date today = current_date();
  auto matcher = load_data(today);
  if (!matcher) {
    // TODO: load data from trackme_dir() / config.json instead
    matcher = parse_matcher(
        {{{"type", "regex_group"}, {"re", "(.*)Mozilla Firefox"}},
         {{"type", "regex_group"}, {"re", "(.*)Discord"}},
         {{"type", "regex_group"}, {"re", "(.*)Microsoft Visual Studio"}},
         {{"type", "regex_group"}, {"re", "(.*)Visual Studio Code"}},
         {{"type", "regex"}, {"re", "Telegram.*"}},
         {{"type", "any"}}});
  }

  Executor executor;
  executor.spawn_periodic(Seconds(1), [&matcher] {
    auto window = current_active_window();
    if (!window.empty() && !paused) {
      track(*matcher, window, Seconds(1));
    }
  });

  executor.spawn_periodic(Seconds(10), [&matcher] {
    const auto json = matcher->to_json().dump(4);
    std::cout << json << std::endl;
  });

  const auto tomorrow = round_up<Days>(Clock::now());
  executor.spawn_periodic_at(tomorrow + Seconds(1), Days(1),
                             [&matcher, &today] {
                               save_data(*matcher, today);
                               today = current_date();
                               matcher->clear();
                             });

  executor.spawn_periodic(Minutes(1),
                          [&matcher, &today] { save_data(*matcher, today); });

  auto tracker_thread = std::thread([&executor, &matcher, &today] {
    executor.run();
    save_data(*matcher, today);
  });

  run_win32_event_loop();
  executor.stop();
  tracker_thread.join();
  return EXIT_SUCCESS;
}
