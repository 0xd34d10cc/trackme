#include "activity_reader.hpp"

#include <charconv>
#include <format>


ActivityReader::ActivityReader(std::istream& stream, std::string filename)
    : m_stream(stream), m_filename(std::move(filename)) {}

static bool is_space(char c) {
  return c == ' ' || c == '\r' || c == '\n' || c == '\t';
}

static std::string_view strip(std::string_view s) {
  while (!s.empty() && is_space(s.front())) {
    s.remove_prefix(1);
  }

  while (!s.empty() && is_space(s.back())) {
    s.remove_suffix(1);
  }

  return s;
}

TimePoint ActivityReader::parse_time(std::string_view s) {
  std::stringstream ss{std::string(s)};
  TimePoint t;
  // 2022-04-23 11:09:12.3345685
  if (!std::chrono::from_stream(ss, "%F %T", t)) {
    fail("failed to parse time");
  }
  return t;
}

ProcessID ActivityReader::parse_pid(std::string_view s) {
  ProcessID id = 0;
  const auto [end, ec] = std::from_chars(s.data(), s.data() + s.size(), id);
  if (ec != std::errc() || end != s.data() + s.size()) {
    fail("failed to parse pid");
  }
  return id;
}

bool ActivityReader::parse_activity(std::string_view line, ActivityEntry& activity) {
  const auto next = [&] {
    line = strip(line);
    size_t i = line.find(',');
    if (i == std::string_view::npos) {
      fail("not enough fields");
    }

    const auto field = line.substr(0, i);
    line.remove_prefix(std::min(i+1, line.size()));
    return field;
  };

  activity.begin = parse_time(next());
  activity.end = parse_time(next());
  activity.pid = parse_pid(next());
  activity.executable = next();
  // FIXME: needs utf-8 aware string to be correct
  // if (line.find(',') != std::string_view::npos) {
  //  throw std::runtime_error("Invalid file format: too many fields");
  // }

  activity.title = strip(line);
  return true;
}

void ActivityReader::fail(std::string_view message) {
  throw std::runtime_error(
      std::format("{}:{} - {}", m_filename, m_line_number, message));
}

bool ActivityReader::read(ActivityEntry& activity) {
  bool success = std::getline(m_stream, m_line) && parse_activity(m_line, activity);
  if (success) {
    ++m_line_number;
  }
  return success;
}