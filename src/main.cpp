#include "executor.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>

#include <wintoastlib.h>
#include <nlohmann/json.hpp>

#include <cstdlib>
#include <cstdint>
#include <iostream>
#include <filesystem>
#include <utility>
#include <thread>
#include <chrono>
#include <array>
#include <string>
#include <string_view>
#include <codecvt>
#include <unordered_map>


using namespace WinToastLib;
using namespace nlohmann;
namespace fs = std::filesystem;

using Seconds = std::chrono::seconds;

static std::string current_active_window() {
  HWND handle = GetForegroundWindow();
  std::array<char, 256> title;
  int n = GetWindowTextA(handle, title.data(), title.size());
  return std::string(title.data(), n);
}

class CustomHandler : public IWinToastHandler {
public:
  void toastActivated() const override {
    std::wcout << L"The user clicked in this toast" << std::endl;
  }

  void toastActivated(int actionIndex) const override {
    std::wcout << L"The user clicked on action #" << actionIndex << std::endl;
  }

  void toastDismissed(WinToastDismissalReason state) const override {
    switch (state) {
    case UserCanceled:
      std::wcout << L"The user dismissed this toast" << std::endl;
      break;
    case TimedOut:
      std::wcout << L"The toast has timed out" << std::endl;
      break;
    case ApplicationHidden:
      std::wcout << L"The application hid the toast using ToastNotifier.hide()" << std::endl;
      break;
    default:
      std::wcout << L"Toast not activated" << std::endl;
      break;
    }
  }

  void toastFailed() const override {
    std::wcout << L"Error showing current toast" << std::endl;
  }
};

static void init_wintoast() {
  if (!WinToast::isCompatible()) {
    return;
  }

  auto* toast = WinToast::instance();
  toast->setAppName(L"trackme");
  toast->setAppUserModelId(L"trackme example");
  if (!toast->initialize()) {
    std::cerr << "Failed to initialize wintoast" << std::endl;
    std::exit(-1);
  }
}

static std::wstring to_wstring(std::string_view text) {
  std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;
  return converter.from_bytes(text.data(), text.data() + text.size());
}

using NotificationID = int64_t;
static const NotificationID INVALID_NOTIFICATION = -1;

static NotificationID show_notification(std::string_view text) {
  WinToastTemplate notification(WinToastTemplate::Text01);
  notification.setTextField(to_wstring(text), WinToastTemplate::FirstLine);
  notification.setAudioOption(WinToastTemplate::AudioOption::Default);
  return WinToast::instance()->showToast(notification, new CustomHandler);
}

static void hide_notification(NotificationID id) {
  WinToast::instance()->hideToast(id);
}

struct Activity {
  Seconds time_spent{ 0 };
  Seconds time_limit{  Seconds::max() };

  json to_json() const {
    json activity;
    activity["time_spent"] = time_spent.count();

    if (time_limit != Seconds::max()) {
      activity["time_limit"] = time_limit.count();
    }

    return activity;
  }
};

class Tracker {
public:
  Tracker() = default;

  void set_limit(std::string name, Seconds limit) {
    auto [it, _] = m_activities.emplace(std::move(name), Activity{});
    it->second.time_limit = limit;
  }

  void update(std::string window, Seconds spent) {
    auto [it, _] = m_activities.emplace(std::move(window), Activity{});
    const auto& name = it->first;
    auto& activity = it->second;

    const bool limit_exceeded = activity.time_spent > activity.time_limit;
    activity.time_spent += spent;

    if (!limit_exceeded && activity.time_spent > activity.time_limit) {
      show_notification(name + " - время вышло, пёс");
    }
  }

  json to_json() const {
    json activities;
    for (const auto& [name, activity] : m_activities) {
      activities[name] = activity.to_json();
    }

    return activities;
  }

private:
  std::unordered_map<std::string, Activity> m_activities;
};

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
  init_wintoast();

  Tracker tracker;
  tracker.set_limit("Task Manager", Seconds(5));

  Executor executor;

  executor.spawn_periodic(Seconds(1), [&tracker] {
    auto window = current_active_window();
    tracker.update(window, Seconds(1));
  });

  executor.spawn_periodic(Seconds(10), [&tracker] {
    std::cout << tracker.to_json().dump(4) << std::endl;
  });

  executor.run();
  return EXIT_SUCCESS;
}