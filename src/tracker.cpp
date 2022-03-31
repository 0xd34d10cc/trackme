#include "tracker.hpp"
#include "notification.hpp"


Json Activity::to_json() const {
  Json activity;
  activity["time_spent"] = time_active.count();

  if (time_limit != Duration::max()) {
    activity["time_limit"] = time_limit.count();
  }

  return activity;
}

void Tracker::set_limit(std::string name, Duration limit) {
  auto [it, _] = m_activities.emplace(std::move(name), Activity{});
  it->second.time_limit = limit;
}

void Tracker::track(std::string title, Duration time_active) {
  for (auto& group : m_groups) {
    if (group.track(title, time_active)) {
      return;
    }
  }

  auto [it, _] = m_activities.emplace(std::move(title), Activity{});
  const auto& name = it->first;
  auto& activity = it->second;

  const bool limit_exceeded = activity.time_active > activity.time_limit;
  activity.time_active += time_active;

  if (!limit_exceeded && activity.time_active > activity.time_limit) {
    show_notification(name + " - time's up");
  }
}

Json Tracker::to_json() const {
  Json activities;
  for (const auto& [name, activity] : m_activities) {
    activities[name] = activity.to_json();
  }

  return activities;

}