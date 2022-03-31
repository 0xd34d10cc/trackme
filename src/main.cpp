#include "executor.hpp"
#include "tracker.hpp"
#include "notification.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>

#include <iostream>
#include <filesystem>
#include <utility>


namespace fs = std::filesystem;

static std::string current_active_window() {
  HWND handle = GetForegroundWindow();
  std::array<char, 256> title;
  int n = GetWindowTextA(handle, title.data(), static_cast<int>(title.size()));
  return std::string(title.data(), n);
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

int main() {
  init_notifications();

  Tracker tracker;
  tracker.set_limit("Task Manager", Seconds(5));

  Executor executor;

  executor.spawn_periodic(Seconds(1), [&tracker] {
    auto window = current_active_window();
    tracker.track(std::move(window), Seconds(1));
  });

  executor.spawn_periodic(Seconds(10), [&tracker] {
    std::cout << tracker.to_json().dump(4) << std::endl;
  });

  executor.run();
  return EXIT_SUCCESS;
}