cmake_minimum_required(VERSION 3.9 FATAL_ERROR)
project(trackme CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)

add_subdirectory(deps)
add_subdirectory(src)