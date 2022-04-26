#include "notification.hpp"
#include "unicode.hpp"

#include <wintoastlib.h>


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
    throw std::runtime_error("Failed to initialize wintoast");
  }
}

NotificationID show_notification(std::string_view text) {
  WinToastTemplate notification(WinToastTemplate::Text01);
  notification.setTextField(utf8_decode(text.data(), text.size()), WinToastTemplate::FirstLine);
  notification.setAudioOption(WinToastTemplate::AudioOption::Default);
  return WinToast::instance()->showToast(notification, new CustomHandler);
}

void hide_notification(NotificationID id) {
  WinToast::instance()->hideToast(id);
}
