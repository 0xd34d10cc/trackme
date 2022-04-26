#include "executor.hpp"
#include "matcher.hpp"
#include "activity_log.hpp"
#include "activity_reader.hpp"
#include "notification.hpp"
#include "activity.hpp"
#include "unicode.hpp"
#include "limiter.hpp"

#include <windows.h>
#include <strsafe.h>

#include <atomic>
#include <filesystem>
#include <format>
#include <fstream>
#include <thread>
#include <utility>


namespace fs = std::filesystem;

static fs::path trackme_dir() {
  if (const char* home = std::getenv("HOME")) {
    return fs::path(home) / "trackme";
  } else if (const char* userprofile = std::getenv("userprofile")) {
    return fs::path(userprofile) / "trackme";
  } else {
    return fs::current_path();
  }
}

struct Config {
  static Config parse(const Json& data) {
    Config config;
    config.max_idle_time = parse_humantime(data.value("max_idle_time", "2m"));

    if (data.contains("matcher")) {
      config.matcher = parse_matcher(data["matcher"]);
    } else {
      config.matcher = std::make_unique<AnyGroupMatcher>();
    }

    return config;
  }

  Duration max_idle_time;
  std::unique_ptr<ActivityMatcher> matcher;
};

static Config load_config() {
  Json data = Json::object();
  const auto path = trackme_dir() / "config.json";

  if (fs::exists(path)) {
    auto config_file =
        std::fstream(path, std::fstream::in | std::fstream::binary);
    config_file >> data;
  }

  return Config::parse(data);
}

static fs::path data_path(Date date) {
  const auto dir = trackme_dir();
  if (!fs::exists(dir) && !fs::create_directories(dir)) {
    throw std::runtime_error("Failed to create trackme dir");
  }

  const auto name =
      std::format("{}-{}-{}.csv", date.day(), date.month(), date.year());
  return dir / name;
}

#define WM_USER_SHELLICON WM_USER + 1

// Global Variables:
// TODO: use SetProp/GetProp instead
NOTIFYICONDATA nidApp;

static std::atomic<bool> paused = false;

LRESULT CALLBACK on_window_message(HWND hWnd, UINT message, WPARAM wParam,
                                   LPARAM lParam) {
  int wmId, wmEvent;
  POINT lpClickPoint;
  HMENU hPopMenu;

  static const uint32_t menu_exit_id = 1337;
  static const uint32_t menu_pause_id = 1338;
  static const uint32_t menu_report = 1339;
  static const uint32_t append = 0xFFFFFFFF;

  switch (message) {
    case WM_USER_SHELLICON:
      // systray msg callback
      switch (LOWORD(lParam)) {
        case WM_RBUTTONDOWN:
          UINT uFlag = MF_BYPOSITION | MF_STRING;
          GetCursorPos(&lpClickPoint);
          hPopMenu = CreatePopupMenu();
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING,
                     menu_pause_id, paused ? L"Resume" : L"Pause");
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING, menu_report,
                     L"Report");
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING,
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
        case menu_report: {
          const wchar_t* filename = NULL;
          const auto dir = utf8_decode(trackme_dir().string());

          OPENFILENAME ofn;         // common dialog box structure
          wchar_t szFile[512] = {0};  // if using TCHAR macros

          // Initialize OPENFILENAME
          std::memset(&ofn, 0, sizeof(ofn));
          ofn.lStructSize = sizeof(ofn);
          ofn.hwndOwner = hWnd;
          ofn.lpstrFile = szFile;
          ofn.nMaxFile = sizeof(szFile);
          ofn.lpstrFilter = L"All\0*.*\0csv\0*.CSV\0";
          ofn.nFilterIndex = 1;
          ofn.lpstrFileTitle = NULL;
          ofn.nMaxFileTitle = 0;
          ofn.lpstrInitialDir = dir.c_str();
          ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST;

          if (GetOpenFileNameW(&ofn) == TRUE) {
            // use ofn.lpstrFile
            filename = ofn.lpstrFile;
            // TODO: generate report in html and open in default browser,
            //       see https://developers.google.com/chart/interactive/docs/gallery/timeline
            OutputDebugStringW(filename);
          }
          break;
        }
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

static void init_systray(HINSTANCE instance) {
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
    throw std::runtime_error("Failed to create window");
  }

  nidApp.cbSize = sizeof(NOTIFYICONDATA);
  nidApp.hWnd = (HWND)hWnd;
  // ID of the icon that willl appear in the system tray
  nidApp.uID = 32512; // IDI_APPLICATION
  nidApp.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
  nidApp.hIcon = LoadIcon(NULL, IDI_APPLICATION);

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

static void track_activities(Limiter& limiter, const fs::path& path) {
  auto file = std::fstream{path, std::fstream::in | std::fstream::binary};
  ActivityReader reader{file};
  ActivityEntry entry;
  while (reader.read(entry)) {
    limiter.track(entry, entry.end - entry.begin);
  }
}

static void run(HINSTANCE instance) {
  init_systray(instance);
  init_notifications();

  const auto path = data_path(current_date());
  auto config = load_config();
  auto limiter = Limiter{std::move(config.matcher)};
  track_activities(limiter, path);
  auto log = ActivityLog::open(path);

  Executor executor;
  executor.spawn_periodic(Seconds(1), [&log, &limiter, max_idle = config.max_idle_time] {
    static const Activity idle_activity = {
        .pid = 0, .executable = "idle", .title = "doing nothing"};

    if (paused) {
      return;
    }

    const auto now = Clock::now();
    if (idle_time() > max_idle) {
      log.track(idle_activity, now);
    } else {
      auto activity = Activity::current();
      // TODO: use prev_now - now instead
      limiter.track(activity, Seconds(1));
      log.track(std::move(activity), now);
    }
  });

  const auto tomorrow = round_up<Days>(Clock::now());
  executor.spawn_periodic_at(tomorrow + Seconds(1), Days(1), [&log] {
    log.flush();
    log = ActivityLog::open(data_path(current_date()));
  });

  auto tracker_thread = std::thread([&executor, &log] {
    try {
      executor.run();
      log.flush();
    } catch (const std::exception& e) {
      // FIXME: propagate exception to the main thread
      OutputDebugStringA(e.what());
      std::abort();
    }
  });

  try {
    run_win32_event_loop();
  } catch (...) {
    executor.stop();
    tracker_thread.join();
    throw;
  }
  executor.stop();
  tracker_thread.join();
}

int WINAPI WinMain(_In_ HINSTANCE instance,
                   _In_opt_ HINSTANCE /*hPrevInstance*/,
                   _In_ LPSTR /*lpCmdLine*/, _In_ int /*nCmdShow*/
) {
  try {
    run(instance);
  }
  catch (const std::exception& e) {
    MessageBoxA(NULL, e.what(), "trackme - error",
                MB_ICONERROR | MB_OK);
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
}
