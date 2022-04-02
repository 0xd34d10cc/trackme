#include "matcher.hpp"


Json Stats::to_json() const {
  Json stats;
  stats["active"] = to_humantime(active);

  if (limit != Duration::max()) {
    stats["limit"] = to_humantime(limit);
  }

  return stats;
}

ActivityMatcher::~ActivityMatcher() {}

void AnyGroupMatcher::set_limit(std::string name, Duration limit) {
  m_stats.emplace(std::move(name), Stats{ {}, limit });
}

Stats* AnyGroupMatcher::match(std::string_view name) {
  std::string n(name); // FIXME: use heterogeneous lookup from C++20
  auto it = m_stats.find(n);
  if (it == m_stats.end()) {
    it = m_stats.emplace_hint(it, std::move(n), Stats{});
  }

  return &it->second;
}

Json AnyGroupMatcher::to_json() const {
  Json matcher = {
    {"type", "any"},
    {"stats", Json::object() }
  };

  Json& m = matcher["stats"];
  for (auto& [name, stats] : m_stats) {
    m[name] = stats.to_json();
  }

  return matcher;
}

AnyGroupMatcher::~AnyGroupMatcher() {}