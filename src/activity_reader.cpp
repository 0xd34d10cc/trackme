#include "activity_reader.hpp"

#include <charconv>


ActivityReader::ActivityReader(std::istream& stream) : m_stream(stream) {}

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

static TimePoint parse_time(std::string_view s) {
  std::stringstream ss{std::string(s)};
  TimePoint t;
  // 2022-04-23 11:09:12.3345685
  if (!std::chrono::from_stream(ss, "%F %T", t)) {
    throw std::runtime_error("Invalid file format: failed to parse time");
  }
  return t;
}

static ProcessID parse_pid(std::string_view s) {
  ProcessID id = 0;
  const auto [end, ec] = std::from_chars(s.data(), s.data() + s.size(), id);
  if (ec != std::errc() || end != s.data() + s.size()) {
    throw std::runtime_error("Invalid file format: failed to parse pid");
  }
  return id;
}

static bool parse_activity(std::string_view line, ActivityEntry& activity) {
  const auto next = [&] {
    line = strip(line);
    size_t i = line.find(',');
    if (i == std::string_view::npos) {
      throw std::runtime_error("Invalid file format: not enough fields");
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

bool ActivityReader::read(ActivityEntry& activity) {
  return std::getline(m_stream, m_line) && parse_activity(m_line, activity);
}