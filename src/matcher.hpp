#pragma once

#include "time.hpp"

#include <nlohmann/json.hpp>

#include <unordered_map>
#include <memory>


using Json = nlohmann::json;

struct Stats {
  Duration active{ Seconds(0) };
  Duration limit{ Duration::max() };

  Json to_json() const;
};

class ActivityMatcher {
public:
  // returns nullptr if *name* doesn't match any "known" activities
  virtual Stats* match(std::string_view name) = 0;
  virtual Json to_json() const = 0;
  virtual ~ActivityMatcher();
};

// matches activity via regex
class RegexGroupMatcher: public ActivityMatcher {
  // TODO
};

// matches *any* activity
class AnyGroupMatcher: public ActivityMatcher {
public:
  AnyGroupMatcher() = default;
  void set_limit(std::string name, Duration limit);

  virtual Stats* match(std::string_view name) override;
  virtual Json to_json() const override;
  virtual ~AnyGroupMatcher() override;

private:
  std::unordered_map<std::string, Stats> m_stats;
};

// goes through a list of groups and returns first that can find a match
class ListMatcher: public ActivityMatcher {
  // TODO
};

// factory function for above
std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data);
