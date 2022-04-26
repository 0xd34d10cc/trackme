#pragma once

#include "activity.hpp"

#include <iosfwd>
#include <string>


class ActivityReader {
 public:
  ActivityReader(std::istream& stream);
  ~ActivityReader() = default;

  bool read(ActivityEntry& activity);

 private:
  std::string m_line;
  std::istream& m_stream;
};