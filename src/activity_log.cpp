#include "activity_log.hpp"

#include <format>

ActivityLog::ActivityLog(std::fstream file, std::optional<Activity> activity)
    : m_file(std::move(file)), m_buffer(4096), m_written(0), m_current(std::move(activity)) {}

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
  flush_buffer();
  m_current.reset();
}

void ActivityLog::flush_buffer() {
  if (m_written == 0) {
    return;
  }

  m_file.write(m_buffer.data(), m_written);
  m_file.flush();
  m_written = 0;
}

void ActivityLog::write_entry(const ActivityEntry& entry) {
  const auto [end, n] =
      std::format_to_n(m_buffer.data() + m_written, m_buffer.size() - m_written,
                       "{}, {}, {}, {}, {}\r\n", entry.begin, entry.end,
                       entry.pid, entry.executable, entry.title);
  if (end >= m_buffer.data() + m_buffer.size()) {
    flush_buffer();
    // TODO: check for n > 4096
    write_entry(entry);
    return;
  }

  m_written += n;
}
