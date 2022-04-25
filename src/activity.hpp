#pragma once

#include "time.hpp"

#include <string>
#include <cstdint>


using ProcessID = uint64_t;

struct Activity {
  static Activity current();

  ProcessID pid;
  std::string executable;
  std::string title;

  auto operator<=>(const Activity&) const = default;
};

struct ActivityEntry : Activity, TimeRange {};

Duration idle_time();