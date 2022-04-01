#include "unicode.hpp"

#include <windows.h>
#include <stringapiset.h>


std::string utf8_encode(const wchar_t* p, size_t n) {
  if (n == 0) {
    return std::string();
  }

  int size_needed = WideCharToMultiByte(CP_UTF8, 0, p, (int)n, NULL, 0, NULL, NULL);
  std::string dst(size_needed, 0);
  WideCharToMultiByte(CP_UTF8, 0, p, (int)n, &dst[0], size_needed, NULL, NULL);
  return dst;
}

std::wstring utf8_decode(const char* p, size_t n) {
  if (n == 0) {
    return std::wstring();
  }

  int size_needed = MultiByteToWideChar(CP_UTF8, 0, p, (int)n, NULL, 0);
  std::wstring dst(size_needed, 0);
  MultiByteToWideChar(CP_UTF8, 0, p, (int)n, &dst[0], size_needed);
  return dst;
}
