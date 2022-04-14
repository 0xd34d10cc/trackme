#include "time.hpp"

#include <array>
#include <charconv>
#include <stdexcept>


std::string to_humantime(Duration d) {
  std::string buffer;

  auto add = [&buffer, &d](Duration period, std::string_view suffix) {
    const auto n = d / period;
    if (n == 0) {
      return;
    }

    std::array<char, 32> num;
    char* num_end = std::to_chars(num.data(), num.data() + num.size(), n).ptr;
    buffer.reserve(buffer.size() + (num_end - num.data()) + suffix.size());
    buffer.append(num.data(), num_end);
    buffer.append(suffix);
    d -= n * period;
  };

  add(Days(1), "d");
  add(Hours(1), "h");
  add(Minutes(1), "m");
  add(Seconds(1), "s");

  if (buffer.empty()) {
    buffer = "0s";
  }

  return buffer;
}

Duration parse_humantime(std::string_view time) {
  auto d = Duration{};

  while (!time.empty()) {
    size_t n = 0;
    const auto [ptr, ec] = std::from_chars(time.data(), time.data() + time.size(), n);
    if (ec != std::errc()) {
      throw std::runtime_error("Invalid time format");
    }

    time.remove_prefix(ptr - time.data());

    if (time.starts_with("d")) {
      d += n * Days(1);
    } else if (time.starts_with("h")) {
      d += n * Hours(1);
    } else if (time.starts_with("m")) {
      d += n * Minutes(1);
    } else if (time.starts_with("s")) {
      d += n * Seconds(1);
    } else {
      throw std::runtime_error("Invalid time suffix");
    }

    time.remove_prefix(1);
  };

  return d;
}