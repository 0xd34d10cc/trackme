#include "executor.hpp"
#include "matcher.hpp"
#include "notification.hpp"
#include "unicode.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>
#include <psapi.h>

#include <iostream>
#include <fstream>
#include <chrono>
#include <filesystem>
#include <utility>
#include <format>
#include <array>


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
    HANDLE process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
    if (process_handle) {
      n = GetModuleFileNameExW(process_handle, (HMODULE)process_handle, title.data(), title_size);
      CloseHandle(process_handle);
    }
  }

#ifdef _DEBUG
  OutputDebugStringW(title.data());
  OutputDebugStringW(L"\n");
#endif

  return utf8_encode(title.data(), n);
}

static bool track(ActivityMatcher& matcher, std::string_view activity, Duration time_active) {
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

  const auto name = std::format("{}-{}-{}.json", date.day(), date.month(), date.year());
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
  auto file = std::fstream(data_path(date), std::fstream::out | std::fstream::binary);
  file << matcher.to_json().dump(4) << std::flush;
}

int main() {
  init_notifications();

  Date today = current_date();
  auto matcher = load_data(today);
  if (!matcher) {
    // TODO: load data from trackme_dir() / config.json instead
    matcher = parse_matcher({
      {
        {"type", "regex"},
        {"re", "(.*) Mozilla Firefox"}
      },
      {
        {"type", "regex"},
        {"re", "Telegram \\((\\d*)\\)"}
      },
      {
        {"type", "any"}
      }
    });
  }

  Executor executor;
  executor.spawn_periodic(Seconds(1), [&matcher] {
    auto window = current_active_window();
    if (!window.empty()) {
      track(*matcher, window, Seconds(1));
    }
  });

  executor.spawn_periodic(Seconds(10), [&matcher] {
    const auto json = matcher->to_json().dump(4);
    std::cout << json << std::endl;
  });

  const auto tomorrow = round_up<Days>(Clock::now());
  executor.spawn_periodic_at(tomorrow+Seconds(1), Days(1), [&matcher, &today] {
    save_data(*matcher, today);
    today = current_date();
    matcher->clear();
  });

  // TODO: also save data on application exit
  executor.spawn_periodic(Minutes(1), [&matcher, &today] {
    save_data(*matcher, today);
  });

  executor.run();
  return EXIT_SUCCESS;
}