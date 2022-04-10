#include "executor.hpp"
#include "tracker.hpp"
#include "notification.hpp"
#include "unicode.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>

#include <iostream>
#include <fstream>
#include <chrono>
#include <filesystem>
#include <utility>
#include <format>

namespace fs = std::filesystem;

static std::string current_active_window() {
  HWND handle = GetForegroundWindow();
  std::array<wchar_t, 256> title;
  int n = GetWindowTextW(handle, title.data(), static_cast<int>(title.size()));

#ifdef _DEBUG
  OutputDebugStringW(title.data());
  OutputDebugStringW(L"\n");
#endif

  return utf8_encode(title.data(), n);
}

// TODO: implement config & store activity data
static fs::path trackme_dir() {
  if (const char* home = std::getenv("HOME")) {
    return fs::path(home) / "trackme";
  } else if (const char* userprofile = std::getenv("userprofile")) {
    return fs::path(userprofile) / "trackme";
  } else {
    return fs::current_path();
  }
}

static std::chrono::year_month_day current_date() {
  return std::chrono::floor<std::chrono::days>(Clock::now());
}

int main() {
  init_notifications();

  std::chrono::day day = current_date().day();

  auto matcher = parse_matcher({
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

  Tracker tracker{ std::move(matcher) };
  Executor executor;

  executor.spawn_periodic(Seconds(1), [&tracker] {
    auto window = current_active_window();
    tracker.track(std::move(window), Seconds(1));
  });

  executor.spawn_periodic(Seconds(10), [&tracker] {
    const auto json = tracker.to_json().dump(4);
    std::cout << json << std::endl;
  });

  executor.spawn_periodic(Minutes(1), [&tracker, &day] {
    const auto json = tracker.to_json().dump(4);
    std::chrono::year_month_day time = current_date();

    // Todo: avoid losing last minute data of the day
    if (time.day() != day) {
      tracker.clear();
      day = time.day();
      return;
    }

    std::string name = std::format("{}-{}-{}.json", time.day(), time.month(), time.year());

    // TODO: handle case when there is no right trackme directory
    auto file = std::fstream(trackme_dir()/name, std::fstream::out | std::fstream::binary);

    file << json;
    file.flush();
  });


  executor.run();
  return EXIT_SUCCESS;
}