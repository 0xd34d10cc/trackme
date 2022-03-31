#pragma once

#include <cstdint>
#include <string_view>


using NotificationID = uint64_t;

void init_notifications();
NotificationID show_notification(std::string_view text);
void hide_notification(NotificationID id);
