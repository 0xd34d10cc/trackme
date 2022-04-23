#pragma once

#include "time.hpp"
#include "activity.hpp"

#include <fstream>
#include <optional>
#include <filesystem>


struct ActivityEntry {
  Activity activity;
  TimeRange active_time;
};

class ActivityLog {
 public:
  static ActivityLog open(const std::filesystem::path& path);

  void track(Activity activity, TimePoint time);
  void flush();

 private:
  ActivityLog(std::fstream file, std::optional<Activity> current);
  void write_entry(const ActivityEntry& entry);


  std::fstream m_file;
  std::optional<ActivityEntry> m_current;
};