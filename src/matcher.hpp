#pragma once

#include "time.hpp"
#include "activity.hpp"

#include <nlohmann/json.hpp>

#include <vector>
#include <memory>
#include <regex>
#include <unordered_set>


using Json = nlohmann::json;

using GroupID = std::string;

class ActivityMatcher {
public:
  // TODO: decouple matcher from Stats
  virtual GroupID match(const Activity& activity) = 0;
  virtual ~ActivityMatcher();
};

// doesn't match any activity
class NoneMatcher : public ActivityMatcher {
 public:
  NoneMatcher() = default;
  ~NoneMatcher() override;

  GroupID match(const Activity& activity) override;
};

// goes through a list of matchers and returns first that can find a match
class ListMatcher: public ActivityMatcher {
public:
  ListMatcher(std::vector<std::unique_ptr<ActivityMatcher>> matchers);
  ~ListMatcher() override;

  GroupID match(const Activity& activity) override;

  static std::unique_ptr<ListMatcher> parse(const Json& data);

private:
  std::vector<std::unique_ptr<ActivityMatcher>> m_matchers;
};

enum class ActivityField {
  Title,
  Executable
};

// matches activity via regex
class RegexMatcher: public ActivityMatcher {
public:
  RegexMatcher(GroupID id, std::string re, ActivityField field);
  ~RegexMatcher() override;

  GroupID match(const Activity& activity) override;

  static std::unique_ptr<RegexMatcher> parse(const Json& data);

private:
  GroupID m_id;
  std::regex m_re;
  ActivityField m_field;
  std::string m_expr;
};

class SetMatcher : public ActivityMatcher {
public:
  SetMatcher(GroupID id, std::unordered_set<std::string> executables);
 ~SetMatcher() override;

 GroupID match(const Activity& activity) override;

private:
 GroupID m_id;
 std::unordered_set<std::string> m_executables;
};

// factory function for above
std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data);
