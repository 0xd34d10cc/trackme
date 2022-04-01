cmake_minimum_required(VERSION 3.9 FATAL_ERROR)
project(trackme CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_VISIBILITY_PRESET hidden)

add_library(
  wintoast

  deps/WinToast/src/wintoastlib.h
  deps/WinToast/src/wintoastlib.cpp
)
target_include_directories(
  wintoast

  PUBLIC deps/WinToast/src/
)

add_library(json INTERFACE)
target_include_directories(json INTERFACE deps/json/single_include/)

add_subdirectory(src)