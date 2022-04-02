#pragma once

#include <chrono>
#include <string>
#include <string_view>


using Clock = std::chrono::system_clock;
using TimePoint = Clock::time_point;
using Duration = Clock::duration;

using Milliseconds = std::chrono::milliseconds;
using Seconds = std::chrono::seconds;
using Minutes = std::chrono::minutes;
using Hours = std::chrono::hours;

std::string to_humantime(Duration time);
Duration parse_humantime(std::string_view time);