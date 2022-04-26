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

ActivityMatcher::~ActivityMatcher() {}

NoneMatcher::~NoneMatcher() {}

Stats* NoneMatcher::match(std::string_view name) {
  return nullptr;
}

void NoneMatcher::clear() {}

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

std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data) {
  if (data.is_array()) {
    return ListMatcher::parse(data);
  }

  const auto type = data["type"];
  if (type == "regex") {
    return RegexMatcher::parse(data);
  }

  throw std::runtime_error("Unknown matcher type");
}