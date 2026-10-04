# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"trackme" is a Windows desktop time/activity tracker built with Tauri. It samples the foreground window once per second, records which executable/title was active, persists it to DuckDB, and visualizes the data in a React UI. It runs in the system tray and keeps tracking after the main window is closed.

The frontend is being rebuilt around a set of 24 documented use cases (daily timeline, summaries, application usage, sessions, transitions, calendar heatmap, …). **P0 — UC-01…UC-04, the daily dashboard — is implemented**; the remaining use cases are follow-up work, and the code is structured so each one is additive.

## Commands

- `npm install` — install frontend (and Tauri CLI) dependencies.
- `npm run tauri dev` — run the app in development (starts the Vite dev server and `cargo run`). Safe to run **alongside the release build**: a debug build resolves its base dir to `~/trackme/debug/`, so it opens a different DuckDB file and there is no lock clash.
- `npm run build` — type-check and build the frontend (`tsc && vite build`); also runs automatically as Tauri's `beforeBuildCommand`.
- `npm test` / `npm run test:watch` — run the frontend test suite (vitest).
- `npm run typecheck` — `tsc --noEmit` on its own.
- `npm run dev` / `npm run preview` — run only the Vite frontend in a browser. `invoke` calls don't resolve outside Tauri, so `src/lib/mock.ts` supplies fixture days instead (see below).

Rust (run from `src-tauri/`):

- `cargo test` — run all Rust tests (only the `activity::matcher` parser has tests).
- `cargo test <name>` — run a single test, e.g. `cargo test exe_eq` or `cargo test activity::matcher`.
- `cargo build` / `cargo check` — build/check the backend.

## Architecture

Two halves bridged by Tauri's `invoke`/`#[tauri::command]` mechanism:

**Backend (Rust, `src-tauri/`)** — `main.rs` wires everything together: builds the system tray and window, initializes global state, and spawns a background `tracker` loop. The four registered commands are `select`, `active_dates`, `get_config`, `set_config`.

`select` uses **overlap** semantics (`begin_ms < to and end_ms > from`), not "began within": a row crossing a day boundary must be visible to both days. The overnight case is real — an idle block from 23:00 to 08:00 is written as a single row — so callers clip each row to their window before summing durations.

- `activity/` — `Activity` (pid, exe, title) with `Activity::current()` reading the foreground window via Win32; `Entry` (begin/end timestamps + activity) that serializes to the frontend as a 5-tuple `[begin_ms, end_ms, pid, exe, title]`.
- `activity/matcher.rs` — a small DSL parsed with `nom` for matching activities, e.g. `exe == 'foo.exe'`, `title contains 'bar'`, `exe ends with 'firefox.exe'`, combinable with `and`/`or`. The grammar is documented in a comment near the bottom of the file.
- `tagger.rs` — `Tagger` maps matchers to named tags; used to classify activities (e.g. for blacklisting).
- `tracker.rs` — the 1-second polling loop: samples current activity, coerces to `idle` after 5 minutes of no input, drops blacklisted tags, and writes an entry whenever the activity changes.
- `idle.rs` — Windows `GetLastInputInfo` idle-time lookup.
- `config.rs` — `Config` = storage location + blacklist (a set of tag names) + flattened `Tagger`.
- `storage/` — an `async_trait` `Storage` trait (`store`, `select`, `active_dates`) with a single DuckDB implementation in `storage/duckdb/`. SQL lives in `storage/duckdb/*.sql`, embedded at compile time via `include_str!`. `duckdb::Connection` is `Send` but `!Sync` and has no async API, so the connection is held behind an `Arc<std::sync::Mutex<_>>` and every call is run via `tauri::async_runtime::spawn_blocking`.

**Frontend (React 19 + TypeScript + Vite 8, `src/`)** — MUI 9 for the design system, ECharts for charts, `@tanstack/react-query` for the server cache, `zustand` for UI state.

Layering rule: `domain/` is pure (no React, no `invoke`), `lib/` is infrastructure, `components/` is the design system, `features/` composes views, `app/` + `shell/` are chrome. **Each new use case gets one folder under `features/` plus at most one `domain/` module** — nothing in `shell/`, `components/` or the data layer needs to move.

- `app/` — `theme.ts` (dark-first, MUI `colorSchemes` + CSS variables), `routes.tsx` (the typed view registry; `dateScoped` decides whether the header shows the date navigator), `store.ts` (zustand, persisted to `localStorage`), `queryClient.ts`, `global.css`.
- `shell/` — `AppShell`, `Sidebar` (grouped, collapsible), `Header`, `DateNavBar` (UC-04).
- `components/` — `Card`, `StatTile`, `KpiRow`, `ChartContainer`, `EChart`, `AppSwatch`, and the loading/empty/error states.
- `lib/` — `tauri.ts` is the **only** module that calls `invoke`; also `time.ts` (UTC day windows), `palette.ts`, `format.ts`, `appIdentity.ts`, `mock.ts`, and the hooks `useActivities` / `useActiveDates` / `useDayModel`.
- `lib/palette.ts` — a **19-slot** categorical palette assigned by **hashing the executable basename** (`appColor(app, mode)`), so an application keeps the same colour on every date regardless of how much time it got. The first eight slots are the curated design-system palette; the other eleven are well-known Tailwind colours (fuchsia, violet, lime, cyan, rose, indigo, pink, green, teal, sky, purple), each at the step that matches the curated eight's lightness band. They were picked by repeatedly adding whichever Tailwind colour was *furthest* from the set — adding Tailwind wholesale gives near-duplicates (Tailwind yellow-600 is ΔE 1.3 from the curated yellow, i.e. the same colour).
  Two properties to preserve: hashing means collisions are expected (19 mutually distinguishable colours do not exist in sRGB — the closest pair is ΔE 5.1), so **the always-visible application labels in the timeline and breakdown are load-bearing**; and the theme's `primary` is a separate constant, not a palette slot, so the palette can change freely. `lib/__tests__/palette.test.ts` guards uniqueness, contrast, lightness and chroma.
- `domain/` — pure, unit-tested: `intervals.ts` (clipping, visits, sessions, switch counting), `summary.ts`, `usage.ts`, `types.ts`. The definitions of *active / idle / tracked / untracked* and of an *application switch* live in comments here and are the contract for every view.
- `features/daily/` — UC-01…UC-03: `DailyView` composes `SummaryTiles`, `TimelineChart` (one ECharts `custom` series, a lane per application plus an optional idle lane) and `AppBreakdown`.
- `features/settings/SettingsView.tsx` — read-only config display. Editing settings is not implemented, and note that the backend's `set_config` does **not** write `config.json`, so changes would not survive a restart anyway.

**Responsiveness is a design requirement, not an afterthought.** `useDayModel` derives the whole day once and all three panels read that one object; hover is handled inside ECharts so it never re-enters React; past days are cached with `staleTime: Infinity` and neighbouring days are prefetched. `src/domain/__tests__/derive.perf.test.ts` guards the derivation budget — keep it passing.

## Key conventions and gotchas

- **All timestamps are epoch milliseconds (`i64`)** crossing the Tauri bridge and stored in DuckDB as `bigint`. `date-fns` and `chrono` are used on their respective sides.
- **Everything is UTC, by design.** The owner runs UTC exclusively, so a "day" is a UTC day and `startOfUtcDay(ms) = ms - (ms % 86400000)`. This deliberately matches `select_active_dates.sql`, which buckets rows by `begin_ms % 86400000`. There is no timezone handling and no DST handling anywhere — UTC has no DST, so every day is exactly 86 400 000 ms. **If the machine's timezone ever changes, day bucketing breaks in both the query bounds and `active_dates`.**
- **Idle is a normal row**, not a flag: `exe = 'idle'`, `title = 'afk'`, `pid = 0`, written after 5 minutes of no input. Blacklisted activity is never written at all, so a period with no rows is "untracked" — which is *not* the same as idle, and the UI must never present it as such.
- **Never group by `pid`** — Windows reuses process ids across time. Application identity is the basename of `exe` (see `lib/appIdentity.ts`), which is a full NT device path like `\Device\HarddiskVolume3\...\chrome.exe`, not a display name.
- **Config and data live in the user's home directory**: `~/trackme/config.json` and `~/trackme/data.duckdb` (`~/trackme/debug/` in debug builds). `parse_config` errors out if the config file is missing — there is no default-config fallback yet.
- The single DuckDB table `activities(begin_ms, end_ms, pid, exe, title)` is created idempotently on startup. There is deliberately no index on `begin_ms`: DuckDB prunes ranges with its per-row-group zone maps, and the data is appended in time order. `begin`/`end` are renamed because `end` is a reserved keyword in DuckDB.
- **Tauri 2 ACL**: IPC permissions live in `src-tauri/capabilities/default.json` (the v1 `allowlist` is gone). The app's own `#[tauri::command]`s are not permission-gated, but plugin/core APIs are. Frontend `invoke` imports come from `@tauri-apps/api/core`.
- **`settings.sql` holds several statements** (`memory_limit`, `threads`, …), so it must run through `Connection::execute_batch`, not `execute` — the latter rejects multiple statements. DuckDB's defaults are ~80% of RAM and every core, which is why they are capped in that file.
- **DuckDB's `sum()` over a `bigint` returns `HUGEINT` (int128)**, which will not decode into an `i64` in Rust — wrap any such aggregate in `cast(... as bigint)`.
- **DuckDB takes an exclusive lock on its file** — unlike SQLite, a second process cannot read it. Run `scripts/migrate_to_duckdb.py` only with the app stopped.
- **Do not blanket-`prevent_exit()`**: `AppHandle::exit(code)` routes through `RunEvent::ExitRequested` with `code` set, so only prevent when `code.is_none()` (all windows closed). Otherwise the tray "Exit" item and the startup-failure dialog cannot terminate the app.
- `scripts/*.py` are standalone data-import/migration helpers and are not wired into the app; `games.py` emits C++ that predates the current Rust backend and references files that no longer exist. `migrate_to_duckdb.py` is the one-off SQLite → DuckDB converter that accompanied the storage swap; it shells out to the `duckdb` binary and lets DuckDB's `sqlite_scanner` read the old file directly, so it needs no Python packages. (Doing the same copy through duckdb's Python bindings is orders of magnitude slower — `executemany` autocommits every row.)
