#pragma once

#include <chrono>
#include <string>


using Clock = std::chrono::system_clock;
using TimePoint = Clock::time_point;
using Duration = Clock::duration;

using Milliseconds = std::chrono::milliseconds;
using Seconds = std::chrono::seconds;
using Minutes = std::chrono::minutes;
using Hours = std::chrono::hours;

std::string to_humantime(Duration time);