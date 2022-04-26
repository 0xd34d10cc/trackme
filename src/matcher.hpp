#pragma once

#include "time.hpp"
#include "activity.hpp"

#include <nlohmann/json.hpp>

#include <vector>
#include <memory>
#include <regex>


using Json = nlohmann::json;

struct Stats {
  Duration active{ Seconds(0) };
  Duration limit{ Duration::max() };

  bool has_limit() const noexcept {
    return limit != Duration::max();
  }

  void clear();
  static Stats parse(const Json& data);
};

class ActivityMatcher {
public:
  virtual Stats* match(const Activity& activity) = 0;
  virtual void clear() = 0;
  virtual ~ActivityMatcher();
};

// doesn't match any activity
class NoneMatcher : public ActivityMatcher {
 public:
  NoneMatcher() = default;
  ~NoneMatcher() override;

  Stats* match(const Activity& activity) override;
  void clear() override;
};

// goes through a list of matchers and returns first that can find a match
class ListMatcher: public ActivityMatcher {
public:
  ListMatcher(std::vector<std::unique_ptr<ActivityMatcher>> matchers);
  ~ListMatcher() override;

  Stats* match(const Activity& activity) override;
  void clear() override;

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
  RegexMatcher(std::string re, ActivityField field);
  ~RegexMatcher() override;

  Stats* match(const Activity& activity) override;
  void clear() override;

  static std::unique_ptr<RegexMatcher> parse(const Json& data);

private:
  std::regex m_re;
  ActivityField m_field;
  std::string m_expr;
  Stats m_stats;
};

// factory function for above
std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data);
