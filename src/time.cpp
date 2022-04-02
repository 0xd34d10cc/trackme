#include "time.hpp"

#include <array>
#include <charconv>


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

  add(Hours(24), "d");
  add(Hours(1), "h");
  add(Minutes(1), "m");
  add(Seconds(1), "s");

  if (buffer.empty()) {
    buffer = "0s";
  }

  return buffer;
}