#pragma once

#include "time.hpp"
#include "activity.hpp"

#include <cstdint>
#include <fstream>
#include <optional>
#include <filesystem>


class ActivityLog {
 public:
  static ActivityLog open(const std::filesystem::path& path);

  void track(Activity activity, TimePoint time);
  void flush();

 private:
  ActivityLog(std::fstream file, std::optional<Activity> current);
  void write_entry(const ActivityEntry& entry);
  void flush_buffer();

  std::fstream m_file;
  std::vector<char> m_buffer;
  std::size_t m_written;
  std::optional<ActivityEntry> m_current;
};