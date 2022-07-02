#include "matcher.hpp"


ActivityMatcher::~ActivityMatcher() {}

NoneMatcher::~NoneMatcher() {}

GroupID NoneMatcher::match(const Activity& activity) { return {}; }

ListMatcher::ListMatcher(std::vector<std::unique_ptr<ActivityMatcher>> matchers)
  : m_matchers(std::move(matchers))
{}

ListMatcher::~ListMatcher() {}

GroupID ListMatcher::match(const Activity& activity) {
  for (auto& matcher : m_matchers) {
    auto id = matcher->match(activity);
    if (!id.empty()) {
      return id;
    }
  }

  return {};
}

std::unique_ptr<ListMatcher> ListMatcher::parse(const Json& data) {
  if (!data.is_array()) {
    throw std::runtime_error(
        "Failed to parse ListMatcher: expected a list of matchers");
  }

  std::vector<std::unique_ptr<ActivityMatcher>> matchers;
  const auto items = data.get<std::vector<Json>>();
  matchers.reserve(items.size());
  for (const auto& item : items) {
    matchers.emplace_back(parse_matcher(item));
  }

  return std::make_unique<ListMatcher>(std::move(matchers));
}

RegexMatcher::RegexMatcher(GroupID id, std::string re, ActivityField field)
    : m_id(std::move(id)), m_re(re), m_field(field), m_expr(std::move(re)) {
  if (m_re.mark_count() != 0) {
    throw std::runtime_error("Expected no groups in regex");
  }
}

RegexMatcher::~RegexMatcher() {}

GroupID RegexMatcher::match(const Activity& activity) {
  const auto& field = m_field == ActivityField::Title ? activity.title : activity.executable;
  if (std::regex_match(field.data(), field.data() + field.size(), m_re)) {
    return m_id;
  }

  return {};
}

std::unique_ptr<RegexMatcher> RegexMatcher::parse(const Json& data) {
  if (data["type"] != "regex") {
    throw std::runtime_error(
        "Failed to parse RegexMatcher: type must be 'regex'");
  }

  ActivityField field = ActivityField::Title;
  if (data.contains("field")) {
    const auto f = data["field"].get<std::string>();
    if (f == "title") {
      field = ActivityField::Title;
    } else if (f == "exe") {
      field = ActivityField::Executable;
    } else {
      throw std::runtime_error("Invalid activity field specifier");
    }
  }

  auto id = data["id"].get<std::string>();
  auto re = data["re"].get<std::string>();
  auto matcher = std::make_unique<RegexMatcher>(std::move(id), std::move(re), field);
  return matcher;
}

SetMatcher::SetMatcher(GroupID id, std::unordered_set<std::string> executables)
    : m_id(std::move(id))
    , m_executables(std::move(executables)) {}

SetMatcher::~SetMatcher() {}

GroupID SetMatcher::match(const Activity& activity) {
  auto exe = activity.exe_name();
  for (char& c : exe) {
    c = tolower(c);
  }

  if (m_executables.contains(exe)) {
    return m_id;
  }

  return {};
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