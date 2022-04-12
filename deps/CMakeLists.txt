add_library(
  wintoast

  WinToast/src/wintoastlib.h
  WinToast/src/wintoastlib.cpp
)
target_include_directories(
  wintoast

  PUBLIC WinToast/src/
)

add_library(json INTERFACE)
target_include_directories(json INTERFACE json/single_include/)