#include <windows.h>
#include <winuser.h>

#include <iostream>
#include <cstdlib>
#include <thread>
#include <chrono>
#include <array>

#include "wintoastlib.h"


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

int main() {
  if (!WinToast::isCompatible()) {
    std::cout << "Not compatible, sadge" << std::endl;
    return EXIT_FAILURE;
  }

  auto* toast = WinToast::instance();
  toast->setAppName(L"trackme");
  toast->setAppUserModelId(L"trackme example");
  if (!toast->initialize()) {
    std::cout << "Failed to initialize" << std::endl;
    return EXIT_FAILURE;
  }

  WinToastTemplate notification(WinToastTemplate::Text02);
  notification.setTextField(L"Hello, world", WinToastTemplate::FirstLine);
  notification.setAudioOption(WinToastTemplate::AudioOption::Default);
  notification.setAttributionText(L"default");

  if (toast->showToast(notification, new CustomHandler) < 0) {
    std::cout << "Failed to show notification" << std::endl;
    return EXIT_FAILURE;
  }

  std::cout << "Success?" << std::endl;
  while (true) {
    std::this_thread::sleep_for(Seconds(1));
    auto window = current_active_window();
    std::cout << window << std::endl;
  }
  return EXIT_SUCCESS;
}