#include "executor.hpp"
#include "matcher.hpp"
#include "notification.hpp"
#include "unicode.hpp"

#define NOMINMAX
#include <windows.h>
#include <winuser.h>
#include <psapi.h>

#include <iostream>
#include <fstream>
#include <chrono>
#include <filesystem>
#include <utility>
#include <format>
#include <array>
#include <thread>


namespace fs = std::filesystem;

static std::string current_active_window() {
  HWND window_handle = GetForegroundWindow();
  if (!window_handle) {
    return std::string{};
  }

  static const int title_size = 256;
  std::array<wchar_t, title_size> title;
  int n = GetWindowTextW(window_handle, title.data(), title_size);
  if (n == 0) {
    DWORD process_id = 0;
    GetWindowThreadProcessId(window_handle, &process_id);
    HANDLE process_handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, process_id);
    if (process_handle) {
      n = GetProcessImageFileNameW(process_handle, title.data(), title_size);
      CloseHandle(process_handle);
    }
  }

#ifdef _DEBUG
  OutputDebugStringW(title.data());
  OutputDebugStringW(L"\n");
#endif

  return utf8_encode(title.data(), n);
}

static bool track(ActivityMatcher& matcher, std::string_view activity, Duration time_active) {
  auto* stats = matcher.match(activity);
  if (!stats) {
    return false;
  }

  const bool limit_exceeded = stats->active > stats->limit;
  stats->active += time_active;

  if (!limit_exceeded && stats->active > stats->limit) {
    show_notification(std::string(activity) + " - time's up");
  }

  return true;
}

static fs::path trackme_dir() {
  if (const char* home = std::getenv("HOME")) {
    return fs::path(home) / "trackme";
  } else if (const char* userprofile = std::getenv("userprofile")) {
    return fs::path(userprofile) / "trackme";
  } else {
    return fs::current_path();
  }
}

static fs::path data_path(Date date) {
  const auto dir = trackme_dir();
  if (!fs::exists(dir) && !fs::create_directories(dir)) {
    std::abort();
  }

  const auto name = std::format("{}-{}-{}.json", date.day(), date.month(), date.year());
  return dir / name;
}

static std::unique_ptr<ActivityMatcher> load_data(Date date) {
  auto path = data_path(date);
  if (!fs::exists(path)) {
    return nullptr;
  }

  auto file = std::fstream(path, std::fstream::in | std::fstream::binary);
  Json data;
  file >> data;
  return parse_matcher(data);
}

static void save_data(const ActivityMatcher& matcher, Date date) {
  auto file = std::fstream(data_path(date), std::fstream::out | std::fstream::binary);
  file << matcher.to_json().dump(4) << std::flush;
}

#include "resource.h"

#define MAX_LOADSTRING 100
#define	WM_USER_SHELLICON WM_USER + 1

// Global Variables:
HINSTANCE hInst;	// current instance
NOTIFYICONDATA nidApp;
HMENU hPopMenu;
TCHAR szTitle[MAX_LOADSTRING];					// The title bar text
TCHAR szWindowClass[MAX_LOADSTRING];			// the main window class name
TCHAR szApplicationToolTip[MAX_LOADSTRING];	    // the main window class name
BOOL bDisable = FALSE;							// keep application state

// Forward declarations of functions included in this code module:
ATOM MyRegisterClass(HINSTANCE hInstance);
BOOL InitInstance(HINSTANCE, int);
LRESULT CALLBACK	WndProc(HWND, UINT, WPARAM, LPARAM);
INT_PTR CALLBACK	About(HWND, UINT, WPARAM, LPARAM);

int WINAPI WinMain(
  HINSTANCE hInstance,
  HINSTANCE hPrevInstance,
  LPSTR     lpCmdLine,
  int       nCmdShow
) {
  init_notifications();

  Date today = current_date();
  auto matcher = load_data(today);
  if (!matcher) {
    // TODO: load data from trackme_dir() / config.json instead
    matcher = parse_matcher({
      {
        {"type", "regex"},
        {"re", "(.*) Mozilla Firefox"}
      },
      {
        {"type", "regex"},
        {"re", "Telegram \\((\\d*)\\)"}
      },
      {
        {"type", "any"}
      }
    });
  }

  Executor executor;
  executor.spawn_periodic(Seconds(1), [&matcher] {
    auto window = current_active_window();
    if (!window.empty()) {
      track(*matcher, window, Seconds(1));
    }
  });

  executor.spawn_periodic(Seconds(10), [&matcher] {
    const auto json = matcher->to_json().dump(4);
    std::cout << json << std::endl;
  });

  const auto tomorrow = round_up<Days>(Clock::now());
  executor.spawn_periodic_at(tomorrow+Seconds(1), Days(1), [&matcher, &today] {
    save_data(*matcher, today);
    today = current_date();
    matcher->clear();
  });

  // TODO: also save data on application exit
  executor.spawn_periodic(Minutes(1), [&matcher, &today] {
    save_data(*matcher, today);
  });

	auto tracker_thread = std::thread([&executor] {
		executor.run();
	});

	UNREFERENCED_PARAMETER(hPrevInstance);
	UNREFERENCED_PARAMETER(lpCmdLine);

	// TODO: Place code here.
	MSG msg;
	HACCEL hAccelTable;

	// Initialize global strings
	LoadString(hInstance, IDS_APP_TITLE, szTitle, MAX_LOADSTRING);
	LoadString(hInstance, IDC_SYSTRAYDEMO, szWindowClass, MAX_LOADSTRING);

	MyRegisterClass(hInstance);

	// Perform application initialization:
	if (!InitInstance(hInstance, nCmdShow)) {
		return FALSE;
	}

	hAccelTable = LoadAccelerators(hInstance, MAKEINTRESOURCE(IDC_SYSTRAYDEMO));

	// Main message loop:
	bool running = true;
	while (running) {
		const int timeout_ms = 100;
		if (MsgWaitForMultipleObjects(0, NULL, FALSE, (int)timeout_ms, QS_ALLINPUT) == WAIT_OBJECT_0) {
			while (running && PeekMessage(&msg, 0, 0, 0, PM_REMOVE)) {
				if (msg.message == WM_QUIT) {
					running = false;
					break;
				}

				if (!TranslateAccelerator(msg.hwnd, hAccelTable, &msg)) {
					TranslateMessage(&msg);
					DispatchMessage(&msg);
				}
			}
		}
	}

	executor.stop();
	tracker_thread.join();
	save_data(*matcher, today);
	return (int)msg.wParam;
}

//
//  FUNCTION: MyRegisterClass()
//
//  PURPOSE: Registers the window class.
//
//  COMMENTS:
//
//    This function and its usage are only necessary if you want this code
//    to be compatible with Win32 systems prior to the 'RegisterClassEx'
//    function that was added to Windows 95. It is important to call this function
//    so that the application will get 'well formed' small icons associated
//    with it.
//
ATOM MyRegisterClass(HINSTANCE hInstance)
{
	WNDCLASSEX wcex;

	wcex.cbSize = sizeof(WNDCLASSEX);

	wcex.style = CS_HREDRAW | CS_VREDRAW;
	wcex.lpfnWndProc = WndProc;
	wcex.cbClsExtra = 0;
	wcex.cbWndExtra = 0;
	wcex.hInstance = hInstance;
	wcex.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_SYSTRAYDEMO));
	wcex.hCursor = LoadCursor(NULL, IDC_ARROW);
	wcex.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
	wcex.lpszMenuName = MAKEINTRESOURCE(IDC_SYSTRAYDEMO);
	wcex.lpszClassName = szWindowClass;
	wcex.hIconSm = LoadIcon(wcex.hInstance, MAKEINTRESOURCE(IDI_SMALL));

	return RegisterClassEx(&wcex);
}

//
//   FUNCTION: InitInstance(HINSTANCE, int)
//
//   PURPOSE: Saves instance handle and creates main window
//
//   COMMENTS:
//
//        In this function, we save the instance handle in a global variable and
//        create and display the main program window.
//
BOOL InitInstance(HINSTANCE hInstance, int nCmdShow)
{
	HWND hWnd;
	HICON hMainIcon;

	hInst = hInstance; // Store instance handle in our global variable

	hWnd = CreateWindow(szWindowClass, szTitle, WS_OVERLAPPEDWINDOW,
		CW_USEDEFAULT, 0, CW_USEDEFAULT, 0, NULL, NULL, hInstance, NULL);

	if (!hWnd)
	{
		return FALSE;
	}

	hMainIcon = LoadIcon(hInstance, (LPCTSTR)MAKEINTRESOURCE(IDI_SYSTRAYDEMO));

	nidApp.cbSize = sizeof(NOTIFYICONDATA); // sizeof the struct in bytes
	nidApp.hWnd = (HWND)hWnd;              //handle of the window which will process this app. messages
	nidApp.uID = IDI_SYSTRAYDEMO;           //ID of the icon that willl appear in the system tray
	nidApp.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP; //ORing of all the flags
	nidApp.hIcon = hMainIcon; // handle of the Icon to be displayed, obtained from LoadIcon
	nidApp.uCallbackMessage = WM_USER_SHELLICON;
	LoadString(hInstance, IDS_APPTOOLTIP, nidApp.szTip, MAX_LOADSTRING);
	Shell_NotifyIcon(NIM_ADD, &nidApp);

	return TRUE;
}

void Init()
{
	// user defined message that will be sent as the notification message to the Window Procedure
}
//
//  FUNCTION: WndProc(HWND, UINT, WPARAM, LPARAM)
//
//  PURPOSE:  Processes messages for the main window.
//
//  WM_COMMAND	- process the application menu
//  WM_PAINT	- Paint the main window
//  WM_DESTROY	- post a quit message and return
//
//
LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
	int wmId, wmEvent;
	POINT lpClickPoint;

	switch (message) {
		case WM_USER_SHELLICON:
			// systray msg callback
			switch (LOWORD(lParam)) {
				case WM_RBUTTONDOWN:
					UINT uFlag = MF_BYPOSITION | MF_STRING;
					GetCursorPos(&lpClickPoint);
					hPopMenu = CreatePopupMenu();
					InsertMenu(hPopMenu, 0xFFFFFFFF, MF_BYPOSITION | MF_STRING, IDM_EXIT, "Exit");
					SetForegroundWindow(hWnd);
					TrackPopupMenu(hPopMenu, TPM_LEFTALIGN | TPM_LEFTBUTTON | TPM_BOTTOMALIGN, lpClickPoint.x, lpClickPoint.y, 0, hWnd, NULL);
					return TRUE;
			}
			break;
		case WM_COMMAND:
			wmId = LOWORD(wParam);
			wmEvent = HIWORD(wParam);
			// Parse the menu selections:
			switch (wmId) {
				case IDM_EXIT:
					Shell_NotifyIcon(NIM_DELETE, &nidApp);
					DestroyWindow(hWnd);
					break;
				default:
					return DefWindowProc(hWnd, message, wParam, lParam);
			}
			break;
		case WM_DESTROY:
			PostQuitMessage(0);
			break;
		default:
			return DefWindowProc(hWnd, message, wParam, lParam);
	}
	return 0;
}