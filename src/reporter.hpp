#pragma once

#include "activity.hpp"

#include <iosfwd>


class Reporter {
 public:
  Reporter(std::ostream& stream);
  ~Reporter();

  void add(const ActivityEntry& activity);

 private:
  std::ostream& m_stream;
};
