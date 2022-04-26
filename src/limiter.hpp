#pragma once

#include "matcher.hpp"
#include "activity.hpp"


class Limiter {
 public:
  Limiter(std::unique_ptr<ActivityMatcher> matcher);

  void track(const Activity& activity, Duration time);
  void reset();

 private:
  std::unique_ptr<ActivityMatcher> m_matcher;
};