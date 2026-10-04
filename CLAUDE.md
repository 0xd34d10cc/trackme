# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"trackme" is a Windows desktop time/activity tracker built with Tauri. It samples the foreground window once per second, records which executable/title was active, persists it to SQLite, and visualizes the data in a React UI (pie charts, timelines, date range picker). It runs in the system tray and keeps tracking after the main window is closed.

## Commands

- `npm install` — install frontend (and Tauri CLI) dependencies.
- `npm run tauri dev` — run the app in development (starts the Vite dev server and `cargo run`).
- `npm run build` — type-check and build the frontend (`tsc && vite build`); also runs automatically as Tauri's `beforeBuildCommand`.
- `npm run dev` / `npm run preview` — run only the Vite frontend in a browser (no Rust backend; `invoke` calls won't resolve).

Rust (run from `src-tauri/`):

- `cargo test` — run all Rust tests (only the `activity::matcher` parser has tests).
- `cargo test <name>` — run a single test, e.g. `cargo test exe_eq` or `cargo test activity::matcher`.
- `cargo build` / `cargo check` — build/check the backend.

There is no JavaScript/TypeScript test framework configured.

## Architecture

Two halves bridged by Tauri's `invoke`/`#[tauri::command]` mechanism:

**Backend (Rust, `src-tauri/`)** — `main.rs` wires everything together: builds the system tray and window, initializes global state, and spawns a background `tracker` loop. The five registered commands are `select`, `active_dates`, `duration_by_exe`, `get_config`, `set_config`.

- `activity/` — `Activity` (pid, exe, title) with `Activity::current()` reading the foreground window via Win32; `Entry` (begin/end timestamps + activity) that serializes to the frontend as a 5-tuple `[begin_ms, end_ms, pid, exe, title]`.
- `activity/matcher.rs` — a small DSL parsed with `nom` for matching activities, e.g. `exe == 'foo.exe'`, `title contains 'bar'`, `exe ends with 'firefox.exe'`, combinable with `and`/`or`. The grammar is documented in a comment near the bottom of the file.
- `tagger.rs` — `Tagger` maps matchers to named tags; used to classify activities (e.g. for blacklisting).
- `tracker.rs` — the 1-second polling loop: samples current activity, coerces to `idle` after 5 minutes of no input, drops blacklisted tags, and writes an entry whenever the activity changes.
- `idle.rs` — Windows `GetLastInputInfo` idle-time lookup.
- `config.rs` — `Config` = storage location + blacklist (a set of tag names) + flattened `Tagger`.
- `storage/` — an `async_trait` `Storage` trait (`store`, `select`, `active_dates`, `duration_by_exe`) with a single SQLite implementation in `storage/sqlite/`. SQL lives in `storage/sqlite/*.sql`, embedded at compile time via `include_str!`; connections are held behind a `tokio::sync::Mutex`.

**Frontend (React 19 + TypeScript + Vite 8, `src/`)** — styled with MUI 9; charts use `react-google-charts`.

- `App.tsx` assembles a side menu from the two views; each view module exports `View()` returning `{ name, icon, component }`, which `SideMenu.tsx` renders in a collapsible MUI drawer.
- `analytics/` — the "Explorer" view: `View.tsx` lays out a date-range picker + pie chart + timeline (timeline for a single day, pie charts for multi-day ranges). `utils.ts` holds the `invoke` wrappers (`useDurationByExe`, `useActivities`) and serialization/color helpers.
- `settings/View.tsx` — currently a stub that just dumps `get_config` as JSON.

## Key conventions and gotchas

- **All timestamps are epoch milliseconds (`i64`)** crossing the Tauri bridge and stored in SQLite as integers. `date-fns` and `chrono` are used on their respective sides.
- **Config and data live in the user's home directory**: `~/trackme/config.json` and `~/trackme/data.db` (`~/trackme/debug/` in debug builds). `parse_config` errors out if the config file is missing — there is no default-config fallback yet.
- The single SQLite table `activities(begin, end, pid, exe, title)` is created idempotently on startup and indexed on `begin`.
- **Tauri 2 ACL**: IPC permissions live in `src-tauri/capabilities/default.json` (the v1 `allowlist` is gone). The app's own `#[tauri::command]`s are not permission-gated, but plugin/core APIs are. Frontend `invoke` imports come from `@tauri-apps/api/core`.
- **`create_table.sql` holds two statements** (table + index), so it must run through `Connection::execute_batch`, not `execute` — the latter rejects multiple statements.
- **Do not blanket-`prevent_exit()`**: `AppHandle::exit(code)` routes through `RunEvent::ExitRequested` with `code` set, so only prevent when `code.is_none()` (all windows closed). Otherwise the tray "Exit" item and the startup-failure dialog cannot terminate the app.
- `scripts/*.py` are standalone data-import/migration helpers (CSV → JSON → SQLite) and are not wired into the app; `games.py` emits C++ that predates the current Rust backend and references files that no longer exist.
