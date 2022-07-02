#include "activity_log.hpp"

#include <format>

ActivityLog::ActivityLog(std::fstream file, std::optional<Activity> activity)
    : m_file(std::move(file)),
      m_buffer(4096),
      m_written(0),
      m_current(std::move(activity)) {}

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
  while (true) {
    const auto free_space = m_buffer.size() - m_written;
    const auto [end, n] = std::format_to_n(
        m_buffer.data() + m_written, free_space, "{}, {}, {}, {}, {}\r\n",
        entry.begin, entry.end, entry.pid, entry.executable, entry.title);

    if (static_cast<std::size_t>(n) < free_space) {
      m_written += n;
      return;
    }

    flush_buffer();
    if (static_cast<std::size_t>(n) > m_buffer.size()) {
      const auto new_size = m_buffer.size() * 2;
      const std::size_t MB = 1024ull * 1024ull;
      if (new_size > 2 * MB) {
        throw std::runtime_error("ActivityLog buffer overflow");
      }

      m_buffer.resize(new_size);
    }
  }
}
