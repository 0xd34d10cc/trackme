#include "executor.hpp"
#include "matcher.hpp"
#include "activity_log.hpp"
#include "activity_reader.hpp"
#include "notification.hpp"
#include "activity.hpp"
#include "unicode.hpp"
#include "limiter.hpp"
#include "reporter.hpp"

#include <windows.h>
#include <strsafe.h>

#include <atomic>
#include <filesystem>
#include <format>
#include <fstream>
#include <thread>
#include <utility>
#include <system_error>


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

    if (data.contains("limiter")) {
      config.limiter = Limiter::parse(data["limiter"]);
    }

    if (data.contains("matcher")) {
      config.matcher = parse_matcher(data["matcher"]);
    }

    return config;
  }

  std::unique_ptr<ActivityMatcher> matcher{std::make_unique<NoneMatcher>()};
  Duration max_idle_time;
  Limiter limiter;
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

static std::vector<fs::path> get_filepathes(HWND hWnd) {
  const auto dir = utf8_decode(trackme_dir().string());

  static const std::size_t MAX_CHARACTERS = 4096;
  OPENFILENAME options;
  wchar_t buffer[MAX_CHARACTERS + 1];  // +1 for null
  buffer[0] = 0;

  std::memset(&options, 0, sizeof(options));
  options.lStructSize = sizeof(options);
  options.hwndOwner = hWnd;
  options.lpstrFile = buffer;
  options.nMaxFile = MAX_CHARACTERS;
  options.lpstrFilter = L"All\0*.*\0csv\0*.CSV\0";
  options.nFilterIndex = 2;  // NOTE: filters are indexed from 1
  options.lpstrFileTitle = NULL;
  options.nMaxFileTitle = 0;
  options.lpstrInitialDir = dir.c_str();
  options.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_ALLOWMULTISELECT |
                  OFN_EXPLORER;

  std::vector<fs::path> files;

  const wchar_t* filename = options.lpstrFile;
  if (GetOpenFileNameW(&options) == TRUE) {
    std::size_t len = lstrlenW(filename);
    if (options.nFileOffset > len) {
      // several files selected
      const auto dir = fs::path(utf8_encode(filename, len));
      const wchar_t* p = filename + len + 1;
      len = lstrlenW(p);
      while (len != 0) {
        files.emplace_back(dir / utf8_encode(p, len));
        p += len + 1;
        len = lstrlenW(p);
      }
    } else {
      files.emplace_back(utf8_encode(filename));
    }
  } else {
    const auto ec = CommDlgExtendedError();
    if (ec) {
      throw std::runtime_error(
          std::format("Failed to open file dialogue. Error code 0x{:x}", ec));
    }
  }

  return files;
}

static void report_files(Reporter& reporter, const std::vector<fs::path> files) {
  for (const auto& path : files) {
    std::fstream file{path, std::fstream::in | std::fstream::binary};
    ActivityReader reader{file, path.string()};

    ActivityEntry entry;
    while (reader.read(entry)) {
      reporter.add(entry);
    }
  }
}

static bool show_report(const fs::path& report_path) {
  wchar_t app[512];
  auto data = report_path.generic_wstring();
  int status = reinterpret_cast<int>(FindExecutableW(data.c_str(), NULL, app));
  if (status > 32) {
    data = L"file:///" + data;
    ShellExecuteW(0, NULL, app, data.c_str(), NULL, SW_SHOWNORMAL);
    return true;
  }

  return false;
}

template <typename ReporterFactory>
static void report(HWND window, ReporterFactory factory, bool user_select = true) {
  try {
    std::vector<fs::path> files;
    if (user_select) {
      files = get_filepathes(window);
    } else {
      for (const auto &entry : fs::directory_iterator(trackme_dir())) {
        if (entry.path().extension() == ".csv") {
          files.push_back(entry.path());
        }
      }
    }

    if (files.empty()) {
      return;
    }

    const auto report_path = trackme_dir() / "report.html";
    auto report = std::fstream(report_path, std::fstream::out | std::fstream::binary);
    auto reporter = factory(report);
    report_files(reporter, files);
    show_report(report_path);
  } catch (const std::exception& e) {
    MessageBoxA(NULL, e.what(), "trackme - failed to generate report",
                MB_ICONERROR | MB_OK);
  }
}

#define WM_USER_SHELLICON WM_USER + 1

// Global Variables:
// TODO: use SetProp/GetProp instead
NOTIFYICONDATA nidApp;

static std::atomic<bool> paused = false;
static std::atomic<const std::exception*> global_exception = nullptr;

static bool set_global_exception(const std::exception* e) {
  const std::exception* expected = nullptr;
  return global_exception.compare_exchange_strong(expected, e);
}

static const std::exception* get_global_exception() {
  return global_exception.load();
}

LRESULT CALLBACK on_window_message(HWND hWnd, UINT message, WPARAM wParam,
                                   LPARAM lParam) {
  int wmId, wmEvent;
  POINT lpClickPoint;
  HMENU hPopMenu;

  // TODO: build an abstraction for menu items
  static const std::uint32_t menu_exit_id = 1337;
  static const std::uint32_t menu_pause_id = 1338;
  static const std::uint32_t menu_timeline_report = 1339;
  static const std::uint32_t menu_pie_report = 1340;
  static const std::uint32_t menu_pie_ranges_report = 1341;
  static const std::uint32_t append = 0xFFFFFFFF;

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
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING, menu_timeline_report,
                     L"Report timeline");
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING,
                     menu_pie_report, L"Report pie");
          InsertMenu(hPopMenu, append, MF_BYPOSITION | MF_STRING,
                     menu_pie_ranges_report, L"Report pie ranges");
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
        case menu_timeline_report: {
          report(hWnd, [](std::fstream& out) { return TimeLineReporter(out); });
          break;
        }
        case menu_pie_report: {
          report(hWnd, [](std::fstream& out) {
            return PieReporter{out, {{"Total", TimeRange::any()}}};
          });
          break;
        }
        case menu_pie_ranges_report: {
          report(hWnd, [](std::fstream& out) {
            const auto now = Clock::now();
            const auto today = round_down<Days>(now);
            std::vector<std::pair<std::string, TimeRange>> ranges{
                {"Today", TimeRange{today, now}},
                {"Last 3 days", TimeRange(today - Days(2), now)},
                {"Last 7 days", TimeRange(today - Days(6), now)},
                {"Last 28 days", TimeRange(today - Days(27), now)},
                {"All", TimeRange::any()},
            };

            return PieReporter{out, ranges};
          }, false);
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
    if (const auto* e = get_global_exception()) {
      throw *e;
    }

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

static void track_activities(ActivityMatcher& matcher, Limiter& limiter, const fs::path& path) {
  // temporary disable notification to prevent popups on startup
  limiter.enable_notifications(false);
  auto file = std::fstream{path, std::fstream::in | std::fstream::binary};
  ActivityReader reader{file, path.string()};
  ActivityEntry entry;

  while (reader.read(entry)) {
    limiter.track(matcher.match(entry), entry.end - entry.begin);
  }
  limiter.enable_notifications(true);
}

static void run(HINSTANCE instance) {
  init_systray(instance);
  init_notifications();

  const auto path = data_path(current_date());
  auto config = load_config();
  auto& matcher = *config.matcher;
  auto& limiter = config.limiter;
  track_activities(matcher, limiter, path);
  auto log = ActivityLog::open(path);

  Executor executor;
  executor.spawn_periodic(Seconds(1), [&log, &limiter, &matcher,
                                       max_idle = config.max_idle_time] {

    static const Activity idle_activity = {
        .pid = 0,
        .executable = "idle",
        .title = "afk"
    };

    if (paused) {
      log.flush();
      return;
    }

    const auto now = Clock::now();
    if (idle_time() > max_idle) {
      log.track(idle_activity, now);
      return;
    }

    auto activity = Activity::current();
    if (!activity.valid()) {
      return;
    }

    // TODO: use prev_now - now instead
    limiter.track(matcher.match(activity), Seconds(1));
    log.track(std::move(activity), now);
  });

  const auto tomorrow = round_up<Days>(Clock::now());
  executor.spawn_periodic_at(tomorrow + Seconds(1), Days(1), [&log, &limiter] {
    log.flush();
    log = ActivityLog::open(data_path(current_date()));
    limiter.reset();
  });

  auto tracker_thread = std::thread([&executor, &log] {
    try {
      executor.run();
      log.flush();
    } catch (const std::exception& e) {
      auto global_exception = std::make_unique<std::runtime_error>(e.what());
      if (set_global_exception(global_exception.get())) {
        global_exception.release();
      }

      log.flush();
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
