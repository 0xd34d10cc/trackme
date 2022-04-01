#include "tracker.hpp"
#include "notification.hpp"


Tracker::Tracker(std::unique_ptr<ActivityMatcher> matcher)
  : m_matcher(std::move(matcher))
{}

bool Tracker::track(std::string title, Duration time_active) {
  auto* stats = m_matcher->match(title);
  if (!stats) {
    return false;
  }

  const bool limit_exceeded = stats->active > stats->limit;
  stats->active += time_active;

  if (!limit_exceeded && stats->active > stats->limit) {
    show_notification(title + " - time's up");
  }

  return true;
}

Json Tracker::to_json() const {
  return m_matcher->to_json();
}