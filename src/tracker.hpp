#pragma once

#include "time.hpp"
#include "matcher.hpp"

#include <string>


class Tracker {
public:
  Tracker(std::unique_ptr<ActivityMatcher> matcher);

  bool track(std::string title, Duration spent);
  Json to_json() const;

private:
  std::unique_ptr<ActivityMatcher> m_matcher;
};
