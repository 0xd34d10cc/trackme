#pragma once

#include "time.hpp"

#include <nlohmann/json.hpp>

#include <unordered_map>
#include <vector>
#include <memory>
#include <regex>


using Json = nlohmann::json;

struct Stats {
  Duration active{ Seconds(0) };
  Duration limit{ Duration::max() };

  void clear();
  Json to_json() const;
  static Stats parse(const Json& data);
};

class StatsGroup {
public:
  StatsGroup() = default;
  StatsGroup(const StatsGroup&) = default;
  StatsGroup(StatsGroup&&) noexcept = default;
  StatsGroup& operator=(const StatsGroup&) = default;
  StatsGroup& operator=(StatsGroup&&) noexcept = default;
  ~StatsGroup() = default;

  Stats* get(std::string_view name);
  Json to_json() const;
  void clear();

  static StatsGroup parse(const Json& data);

private:
  struct StringHasher {
    using is_transparent = void;

    size_t operator()(const std::string& s) const noexcept {
      return std::hash<std::string_view>()(std::string_view(s));
    }

    size_t operator()(std::string_view s) const noexcept {
      return std::hash<std::string_view>()(s);
    }
  };

  using StatsMap = std::unordered_map<std::string, Stats, StringHasher, std::equal_to<>>;
  StatsMap m_stats;
};

class ActivityMatcher {
public:
  // returns nullptr if *name* doesn't match any "known" activities
  virtual Stats* match(std::string_view name) = 0;
  virtual Json to_json() const = 0;
  virtual void clear() = 0;
  virtual ~ActivityMatcher();
};

// matches *any* activity
class AnyGroupMatcher: public ActivityMatcher {
public:
  AnyGroupMatcher() = default;
  ~AnyGroupMatcher() override;

  Stats* match(std::string_view name) override;
  Json to_json() const override;
  void clear() override;

  static std::unique_ptr<AnyGroupMatcher> parse(const Json& data);

private:
  StatsGroup m_stats;
};

// goes through a list of matchers and returns first that can find a match
class ListMatcher: public ActivityMatcher {
public:
  ListMatcher(std::vector<std::unique_ptr<ActivityMatcher>> matchers);
  ~ListMatcher() override;

  Stats* match(std::string_view name) override;
  Json to_json() const override;
  void clear() override;

  static std::unique_ptr<ListMatcher> parse(const Json& data);

private:
  std::vector<std::unique_ptr<ActivityMatcher>> m_matchers;
};

// matches activity via regex
class RegexGroupMatcher : public ActivityMatcher {
public:
  RegexGroupMatcher(std::string re);
  ~RegexGroupMatcher() override;

  Stats* match(std::string_view name) override;
  Json to_json() const override;
  void clear() override;

  static std::unique_ptr<RegexGroupMatcher> parse(const Json& data);

private:
  std::regex m_re;
  std::string m_expr;
  StatsGroup m_stats;
};

// factory function for above
std::unique_ptr<ActivityMatcher> parse_matcher(const Json& data);
