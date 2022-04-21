add_executable(
  trackme

  main.cpp
  time.hpp
  time.cpp
  executor.hpp
  executor.cpp
  notification.hpp
  notification.cpp
  unicode.hpp
  unicode.cpp
  matcher.hpp
  matcher.cpp
  activity.hpp
  activity.cpp
)

target_compile_definitions(
  trackme

  PUBLIC UNICODE
  PUBLIC _UNICODE
  PUBLIC _CRT_SECURE_NO_WARNINGS
  PUBLIC NOMINMAX
)

target_link_libraries(
  trackme

  PUBLIC wintoast
  PUBLIC json
)

set_target_properties(
  trackme PROPERTIES

  WIN32_EXECUTABLE ON
  MACOSX_BUNDLE ON
)