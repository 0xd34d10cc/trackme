#include "matcher.hpp"


void Stats::clear() {
  active = Duration{};
}

Json Stats::to_json() const {
  auto stats = Json::object();
  stats["active"] = to_humantime(active);

  if (limit != Duration::max()) {
    stats["limit"] = to_humantime(limit);
  }

  return stats;
}

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

Stats* StatsGroup::get(std::string_view name) {
  auto it = m_stats.find(name);
  if (it == m_stats.end()) {
    it = m_stats.emplace_hint(it, std::string(name), Stats{});
  }

  return &it->second;
}

Json StatsGroup::to_json() const {
  auto group = Json::object();
  for (auto& [name, stats] : m_stats) {
    group[name] = stats.to_json();
  }
  return group;
}

void StatsGroup::clear() {
  auto it = m_stats.begin();
  while (it != m_stats.end()) {
    auto& stats = it->second;
    if (!stats.has_limit()) {
      it = m_stats.erase(it);
    } else {
      stats.clear();
      ++it;
    }
  }
}

StatsGroup StatsGroup::parse(const Json& data) {
  StatsGroup group;
  for (auto& [name, stats] : data.items()) {
    group.m_stats[name] = Stats::parse(stats);
  }
  return group;
}

ActivityMatcher::~ActivityMatcher() {}

AnyGroupMatcher::~AnyGroupMatcher() {}

Stats* AnyGroupMatcher::match(std::string_view name) {
  return m_stats.get(name);
}

Json AnyGroupMatcher::to_json() const {
  return {
    {"type", "any"},
    {"stats", m_stats.to_json() }
  };
}

void AnyGroupMatcher::clear() {
  m_stats.clear();
}

std::unique_ptr<AnyGroupMatcher> AnyGroupMatcher::parse(const Json& data) {
  if (data["type"] != "any") {
    throw std::runtime_error("Failed to parse AnyGroupMatcher: type must be 'any'");
  }

  auto matcher = std::make_unique<AnyGroupMatcher>();
  if (data.contains("stats")) {
    matcher->m_stats = StatsGroup::parse(data["stats"]);
  }
  return matcher;
}

ListMatcher::ListMatcher(std::vector<std::unique_ptr<ActivityMatcher>> matchers)
  : m_matchers(std::move(matchers))
{}

ListMatcher::~ListMatcher() {}

Stats* ListMatcher::match(std::string_view name) {
  for (auto& matcher : m_matchers) {
    if (auto* stats = matcher->match(name)) {
      return stats;
    }
  }

  return nullptr;
}

Json ListMatcher::to_json() const {
  std::vector<Json> matchers;
  for (const auto& matcher : m_matchers) {
    matchers.emplace_back(matcher->to_json());
  }
  return std::move(matchers);
}

void ListMatcher::clear() {
  for (auto& matcher : m_matchers) {
    matcher->clear();
  }
}

std::unique_ptr<ListMatcher> ListMatcher::parse(const Json& data) {
  if (!data.is_array()) {
    throw std::runtime_error("Failed to parse ListMatcher: expected a list of matchers");
  }

  std::vector<std::unique_ptr<ActivityMatcher>> matchers;
  const auto items = data.get<std::vector<Json>>();
  matchers.reserve(items.size());
  for (const auto& item : items) {
    matchers.emplace_back(parse_matcher(item));
  }

  return std::make_unique<ListMatcher>(std::move(matchers));
}

RegexMatcher::RegexMatcher(std::string re)
  : m_re(re)
  , m_expr(std::move(re))
{
  if (m_re.mark_count() != 0) {
    throw std::runtime_error("Expected no groups in regex");
  }
}

RegexMatcher::~RegexMatcher() {}

Stats* RegexMatcher::match(std::string_view name) {
  if (std::regex_match(name.data(), name.data() + name.size(), m_re)) {
    return &m_stats;
  }

  return nullptr;
}

Json RegexMatcher::to_json() const {
  return {
    {"type", "regex"},
    {"re", m_expr},
    {"stats", m_stats.to_json()}
  };
}

void RegexMatcher::clear() {
  m_stats.clear();
}

std::unique_ptr<RegexMatcher> RegexMatcher::parse(const Json& data) {
  if (data["type"] != "regex") {
    throw std::runtime_error("Failed to parse RegexMatcher: type must be 'regex'");
  }

  auto matcher = std::make_unique<RegexMatcher>(data["re"].get<std::string>());
  if (data.contains("stats")) {
    matcher->m_stats = Stats::parse(data["stats"]);
  }

  return matcher;
}

RegexGroupMatcher::RegexGroupMatcher(std::string re)
  : m_re(re)
  , m_expr(std::move(re))
{
  if (m_re.mark_count() != 1) {
    throw std::runtime_error("Expected exactly one group in regex");
  }
}

RegexGroupMatcher::~RegexGroupMatcher() {}

Stats* RegexGroupMatcher::match(std::string_view name) {
  std::cregex_token_iterator it(name.data(), name.data() + name.size(), m_re, 1);
  std::cregex_token_iterator end;

  if (it == end) {
    return nullptr;
  }

  return m_stats.get(std::string_view(it->first, it->second));
}

Json RegexGroupMatcher::to_json() const {
  return {
    {"type", "regex_group"},
    {"re", m_expr},
    {"stats", m_stats.to_json()}
  };
}

void RegexGroupMatcher::clear() {
  m_stats.clear();
}

std::unique_ptr<RegexGroupMatcher> RegexGroupMatcher::parse(const Json& data) {
  if (data["type"] != "regex_group") {
    throw std::runtime_error("Failed to parse RegexGroupMatcher: type must be 'regex_group'");
  }

  auto matcher = std::make_unique<RegexGroupMatcher>(data["re"].get<std::string>());
  if (data.contains("stats")) {
    matcher->m_stats = StatsGroup::parse(data["stats"]);
  }
  return matcher;
}

std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data) {
  if (data.is_array()) {
    return ListMatcher::parse(data);
  }

  const auto type = data["type"];
  if (type == "any") {
    return AnyGroupMatcher::parse(data);
  }

  if (type == "regex") {
    return RegexMatcher::parse(data);
  }

  if (type == "regex_group") {
    return RegexGroupMatcher::parse(data);
  }

  throw std::runtime_error("Unknown matcher type");
}