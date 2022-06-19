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
  activity_log.hpp
  activity_log.cpp
  activity_reader.hpp
  activity_reader.cpp
  limiter.hpp
  limiter.cpp
  reporter.hpp
  reporter.cpp
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

install(
  TARGETS trackme
  RUNTIME
  DESTINATION bin
  COMPONENT applications
  )

# CPACK macros below here
#
set (CPACK_PACKAGE_NAME "TrackMe")
set (CPACK_PACKAGE_VENDOR "CMake.org")
set (CPACK_PACKAGE_DESCRIPTION_SUMMARY "TrackMe - lighweight application time tracker")
set (CPACK_PACKAGE_VERSION "1.0.0")
set (CPACK_PACKAGE_VERSION_MAJOR "1")
set (CPACK_PACKAGE_VERSION_MINOR "0")
set (CPACK_PACKAGE_VERSION_PATCH "0")
set (CPACK_PACKAGE_INSTALL_DIRECTORY "TrackMe")

# Define components and their display names
set (CPACK_COMPONENTS_ALL applications)
set (CPACK_COMPONENT_APPLICATIONS_DISPLAY_NAME "TrackMe")

# Human readable component descriptions
set (CPACK_COMPONENT_APPLICATIONS_DESCRIPTION
  "An extremely useful self-discipline helper that helps you to track your time")

# Define groups
set(CPACK_COMPONENT_APPLICATIONS_GROUP "Runtime")

set(CPACK_COMPONENT_GROUP_DEVELOPMENT_DESCRIPTION
   "TrackMe Inc.")

# Define NSIS installation types
set(CPACK_ALL_INSTALL_TYPES Full Developer)
set(CPACK_COMPONENT_LIBRARIES_INSTALL_TYPES Developer Full)
set(CPACK_COMPONENT_HEADERS_INSTALL_TYPES Developer Full)
set(CPACK_COMPONENT_APPLICATIONS_INSTALL_TYPES Full)
 
# Must be after the last CPACK macros
include(CPack)