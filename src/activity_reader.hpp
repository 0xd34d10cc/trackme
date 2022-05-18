#pragma once

#include "activity.hpp"

#include <iosfwd>
#include <cstddef>
#include <string>


class ActivityReader {
 public:
  ActivityReader(std::istream& stream, std::string filename);
  ~ActivityReader() = default;

  bool read(ActivityEntry& activity);

 private:
  TimePoint parse_time(std::string_view s);
  ProcessID parse_pid(std::string_view s);
  bool parse_activity(std::string_view line, ActivityEntry& activity);

  void fail(std::string_view message);


  std::string m_line;
  std::istream& m_stream;

  // debug info
  std::string m_filename;
  std::size_t m_line_number{ 1 };
};