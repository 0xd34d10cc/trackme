#define NOMINMAX
#include <windows.h>
#include <winuser.h>

#include <wintoastlib.h>

#include <iostream>
#include <cstdlib>
#include <thread>
#include <chrono>
#include <array>
#include <string>
#include <string_view>
#include <codecvt>
#include <unordered_map>


using namespace WinToastLib;

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

static bool show_notification(std::string_view text) {
  WinToastTemplate notification(WinToastTemplate::Text01);
  notification.setTextField(to_wstring(text), WinToastTemplate::FirstLine);
  notification.setAudioOption(WinToastTemplate::AudioOption::Default);
  return WinToast::instance()->showToast(notification, new CustomHandler) >= 0;
}

struct Activity {
  Seconds time_spent{ 0 };
  Seconds time_limit{  Seconds::max() };
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
      show_notification(name + " - time exceeded");
    }
  }

  void print_to(std::ostream& os) const {
    os << "[\n";
    for (const auto& [name, activity] : m_activities) {
      os << name << " - " << activity.time_spent.count() << "s";
    }
    os << "]\n" << std::flush;
  }

private:
  std::unordered_map<std::string, Activity> m_activities;
};

int main() {
  init_wintoast();

  Tracker tracker;
  tracker.set_limit("Task Manager", Seconds(5));

  while (true) {
    std::this_thread::sleep_for(Seconds(1));
    auto window = current_active_window();
    tracker.update(window, Seconds(1));
  }

  return EXIT_SUCCESS;
}