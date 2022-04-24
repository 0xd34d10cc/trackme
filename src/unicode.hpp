#pragma once

#include <string>

std::string utf8_encode(const wchar_t* p, size_t n);
inline std::string utf8_encode(const std::wstring s) {
  return utf8_encode(s.data(), s.size());
}

std::wstring utf8_decode(const char* p, size_t n);
inline std::wstring utf8_decode(const std::string& s) {
  return utf8_decode(s.data(), s.size());
}