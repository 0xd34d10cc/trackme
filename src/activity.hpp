#pragma once

#include "time.hpp"

#include <string>
#include <cstdint>


using ProcessID = uint64_t;

struct Activity {
  static Activity current();
  bool valid() const;

  ProcessID pid{ 0 };
  std::string executable;
  std::string title;

  auto operator<=>(const Activity&) const = default;
};

struct ActivityEntry : Activity, TimeRange {};

Duration idle_time();