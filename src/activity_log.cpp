#include "activity_log.hpp"

ActivityLog::ActivityLog(std::fstream file, std::optional<Activity> activity)
    : m_file(std::move(file)), m_current(std::move(activity)) {}

ActivityLog ActivityLog::open(const std::filesystem::path& path) {
  const auto flags = std::ios::out | std::ios::binary | std::ios::app;
  std::fstream file(path, flags);
  if (!file.is_open()) {
    throw std::runtime_error("Failed to open activity log");
  }

  return ActivityLog{std::move(file), std::nullopt};
}

void ActivityLog::track(Activity activity, TimePoint time) {
  if (!m_current) {
    m_current = ActivityEntry{std::move(activity), time, time};
    return;
  }

  m_current->end = time;
  if (activity == *m_current) {
    return;
  }

  write_entry(*m_current);
  m_current = ActivityEntry{std::move(activity), time, time};
}

void ActivityLog::flush() {
  if (!m_current) {
    return;
  }

  write_entry(*m_current);
  m_current.reset();
}

void ActivityLog::write_entry(const ActivityEntry& entry) {
  const auto serialized =
      std::format("{}, {}, {}, {}, {}\r\n", entry.begin, entry.end, entry.pid,
                  entry.executable, entry.title);

  m_file.write(serialized.data(), serialized.size());
  // TODO: flush only complete csv lines so file is always valid
  // m_file.flush();
}
