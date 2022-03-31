#pragma once

#include "time.hpp"

#include <nlohmann/json.hpp>

#include <string>
#include <string_view>
#include <regex>
#include <vector>
#include <unordered_map>


using Json = nlohmann::json;

struct Activity {
  Duration time_active{ Seconds(0) };
  Duration time_limit{ Duration::max() };

  Json to_json() const;
};

// TODO: make it an interface
// TODO: implement
struct ActivityGroup {
  std::string name;
  std::regex matcher;
  std::unordered_map<std::string, Activity> activities;

  bool track(std::string_view title, Duration spent) {
    // TODO
    return false;
  }
};

class Tracker {
public:
  Tracker() = default;

  void set_limit(std::string name, Duration limit);
  void track(std::string title, Duration spent);
  Json to_json() const;

private:
  std::vector<ActivityGroup> m_groups;

  // TODO: this could be just a "general" activity group
  std::unordered_map<std::string, Activity> m_activities;
};
