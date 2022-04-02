add_executable(
  trackme

  main.cpp
  time.hpp
  time.cpp
  executor.hpp
  executor.cpp
  tracker.hpp
  tracker.cpp
  notification.hpp
  notification.cpp
  unicode.hpp
  unicode.cpp
  matcher.hpp
  matcher.cpp
)

target_link_libraries(
  trackme

  PUBLIC wintoast
  PUBLIC json
)