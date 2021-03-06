#pragma once

#include <chrono>
#include <string>
#include <string_view>


using Clock = std::chrono::system_clock;
using TimePoint = Clock::time_point;
using Duration = Clock::duration;
using Date = std::chrono::year_month_day;
using TimeOfDay = std::chrono::hh_mm_ss<Duration>;

using Milliseconds = std::chrono::milliseconds;
using Seconds = std::chrono::seconds;
using Minutes = std::chrono::minutes;
using Hours = std::chrono::hours;
using Days = std::chrono::days;
using Months = std::chrono::months;
using Years = std::chrono::years;

struct TimeRange {
  TimePoint begin;
  TimePoint end;

  static TimeRange any() { return {TimePoint::min(), TimePoint::max()}; }
  Duration duration() const noexcept { return end - begin; }
  bool contains(TimePoint p) const noexcept { return end <= p && p <= begin; }
  bool empty() const noexcept { return begin >= end; }

  TimeRange overlap(TimeRange other) const noexcept {
    const auto b = std::max(begin, other.begin);
    const auto e = std::min(end, other.end);
    return { b, e };
  }
};

template <typename Dur>
auto round_down(TimePoint time) {
	return std::chrono::floor<Dur>(time);
}

template <typename Dur>
auto round_up(TimePoint time) {
	return std::chrono::ceil<Dur>(time);
}

inline Date current_date() {
	return round_down<Days>(Clock::now());
}

std::string to_humantime(Duration time, std::string_view delimiter = "");
Duration parse_humantime(std::string_view time);