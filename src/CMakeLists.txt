add_executable(
  trackme

  main.cpp

  executor.hpp
  executor.cpp
)

target_link_libraries(
  trackme

  PUBLIC wintoast
  PUBLIC json
)