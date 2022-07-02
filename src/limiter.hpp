#pragma once

#include "matcher.hpp"
#include "activity.hpp"

#include <unordered_map>


struct Stats {
  Duration active{Seconds(0)};
  Duration limit{Duration::max()};

  bool has_limit() const noexcept { return limit != Duration::max(); }

  void clear();
  static Stats parse(const Json& data);
};

class Limiter {
 public:
  Limiter();
  static Limiter parse(const Json& data);

  void track(const GroupID& id, Duration time);
  void reset();
  void enable_notifications(bool notify);

 private:
  using StatsMap = std::unordered_map<GroupID, Stats>;

  Limiter(StatsMap stats);

  bool m_notify;
  StatsMap m_stats;
};