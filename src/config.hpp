#pragma once

#include <nlohmann/json.hpp>

#include <memory>

#include "time.hpp"
#include "matcher.hpp"

using Json = nlohmann::json;

struct Config {
  Config(Json config_data) {
    max_idle_time = parse_humantime(config_data.value("max_idle_time", "2m"));
    dump_data_period =
        parse_humantime(config_data.value("dump_data_period", "1m"));

    if (config_data.contains("matcher")) {
      matcher = parse_matcher(config_data["matcher"]);
    } else {
      matcher = std::make_unique<AnyGroupMatcher>();
    }
  }

  Duration max_idle_time;
  Duration dump_data_period;
  std::unique_ptr<ActivityMatcher> matcher;
};