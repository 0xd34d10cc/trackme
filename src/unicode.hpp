#pragma once

#include <string>

std::string utf8_encode(const wchar_t* p, size_t n);
std::wstring utf8_decode(const char* p, size_t n);