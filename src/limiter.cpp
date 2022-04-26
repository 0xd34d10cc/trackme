#include "limiter.hpp"
#include "notification.hpp"


Limiter::Limiter(std::unique_ptr<ActivityMatcher> matcher)
    : m_matcher(std::move(matcher)) {}

void Limiter::track(const Activity& activity, Duration time) {
  if (auto* stats = m_matcher->match(activity.title)) {
    const bool limit_exceeded = stats->active > stats->limit;
    stats->active += time;

    if (!limit_exceeded && stats->active > stats->limit) {
      show_notification(activity.title + " - time's up");
    }
  }
}