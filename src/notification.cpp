#include "notification.hpp"

#include <wintoastlib.h>

#include <string>
#include <codecvt>


using namespace WinToastLib;

class CustomHandler : public IWinToastHandler {
public:
  void toastActivated() const override {
  }

  void toastActivated(int actionIndex) const override {
  }

  void toastDismissed(WinToastDismissalReason state) const override {
    switch (state) {
    case UserCanceled:
      break;
    case TimedOut:
      break;
    case ApplicationHidden:
      break;
    default:
      break;
    }
  }

  void toastFailed() const override {
  }
};

void init_notifications() {
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

NotificationID show_notification(std::string_view text) {
  WinToastTemplate notification(WinToastTemplate::Text01);
  notification.setTextField(to_wstring(text), WinToastTemplate::FirstLine);
  notification.setAudioOption(WinToastTemplate::AudioOption::Default);
  return WinToast::instance()->showToast(notification, new CustomHandler);
}

void hide_notification(NotificationID id) {
  WinToast::instance()->hideToast(id);
}
