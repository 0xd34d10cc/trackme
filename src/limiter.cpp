#include "limiter.hpp"
#include "notification.hpp"


void Stats::clear() { active = Duration{}; }

Stats Stats::parse(const Json& data) {
  Stats stats{};

  if (data.contains("active")) {
    stats.active = parse_humantime(data["active"].get<std::string>());
  }

  if (data.contains("limit")) {
    stats.limit = parse_humantime(data["limit"].get<std::string>());
  }

  return stats;
}

Limiter::Limiter()
    : m_matcher(std::make_unique<NoneMatcher>()), m_stats(), m_notify(true) {}

Limiter::Limiter(std::unique_ptr<ActivityMatcher> matcher, StatsMap stats)
    : m_matcher(std::move(matcher)), m_stats(std::move(stats)), m_notify(true) {}

void Limiter::track(const Activity& activity, Duration time) {
  const auto id = m_matcher->match(activity);
  if (id.empty()) {
    return;
  }

  auto it = m_stats.find(id);
  if (it == m_stats.end()) {
    it = m_stats.emplace(id, Stats{}).first;
  }

  auto& stats = it->second;
  const bool limit_exceeded = stats.active > stats.limit;
  stats.active += time;

  if (!limit_exceeded && stats.active > stats.limit && m_notify) {
    show_notification(activity.title + " - time's up");
  }
}

void Limiter::reset() {
  auto it = m_stats.begin();
  while (it != m_stats.end()) {
    auto& stats = it->second;
    if (stats.has_limit()) {
      stats.clear();
    } else {
      it = m_stats.erase(it);
    }
  }
}

void Limiter::enable_notifications(bool notify) { m_notify = notify; }

Limiter Limiter::parse(const Json& data) {
  StatsMap stats;
  const auto map = data["limits"].get<std::unordered_map<std::string, Json>>();
  for (const auto& [id, s] : map) {
    stats.emplace(id, Stats::parse(s));
  }

  auto matcher = parse_matcher(data["matcher"]);
  return Limiter(std::move(matcher), std::move(stats));
}