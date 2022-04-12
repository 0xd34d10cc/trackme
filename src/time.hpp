#pragma once

#include <chrono>
#include <string>
#include <string_view>


using Clock = std::chrono::system_clock;
using TimePoint = Clock::time_point;
using Duration = Clock::duration;
using Date = std::chrono::year_month_day;

inline Date current_date() {
	return std::chrono::floor<std::chrono::days>(Clock::now());
}

using Milliseconds = std::chrono::milliseconds;
using Seconds = std::chrono::seconds;
using Minutes = std::chrono::minutes;
using Hours = std::chrono::hours;
using Days = std::chrono::days;
using Months = std::chrono::months;
using Years = std::chrono::years;

std::string to_humantime(Duration time);
Duration parse_humantime(std::string_view time);