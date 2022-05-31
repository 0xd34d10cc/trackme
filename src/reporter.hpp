#pragma once

#include "activity.hpp"

#include <unordered_map>
#include <iosfwd>


class Reporter {
 public:
  virtual ~Reporter() {}
  virtual void add(const ActivityEntry& entry) = 0;
};

class TimeLineReporter: public Reporter {
 public:
  TimeLineReporter(std::ostream& stream);
  TimeLineReporter(const TimeLineReporter&) = delete;
  TimeLineReporter& operator=(const TimeLineReporter&) = delete;
  ~TimeLineReporter() override;

  void add(const ActivityEntry& activity) override;

 private:
  std::ostream& m_stream;
};

class PieReporter: public Reporter {
 public:
  PieReporter(std::ostream& stream, std::vector<std::pair<std::string, TimeRange>> ranges);
  PieReporter(const PieReporter&) = delete;
  PieReporter& operator=(const PieReporter&) = delete;
  ~PieReporter() override;

  void add(const ActivityEntry& activity) override;

 private:
  struct StatsGroup {
    std::string name;
    TimeRange range;
    Duration total{};
    std::unordered_map<std::string, Duration> activities;

    StatsGroup(std::string n, TimeRange r) : name(std::move(n)), range(r) {}

    bool track(const ActivityEntry& e) {
      const auto overlap = range.overlap(e);
      if (overlap.empty()) {
        return false;
      }

      const auto duration = overlap.duration();
      activities[e.exe_name()] += duration;
      total += duration;
      return true;
    }
  };

  void report_group(const StatsGroup& g);

  std::ostream& m_stream;
  std::vector<StatsGroup> m_groups;
};