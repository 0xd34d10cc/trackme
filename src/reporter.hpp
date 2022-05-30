#pragma once

#include "activity.hpp"

#include <unordered_map>
#include <iosfwd>


class TimeLineReporter {
 public:
  TimeLineReporter(std::ostream& stream);
  ~TimeLineReporter();

  void add(const ActivityEntry& activity);

 private:
  std::ostream& m_stream;
};

class PieReporter {
 public:
  PieReporter(std::ostream& stream);
  ~PieReporter();

  void add(const ActivityEntry& activity);

 private:
  std::ostream& m_stream;
  Duration m_total{};
  std::unordered_map<std::string, Duration> m_activities;
};