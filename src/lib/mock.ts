import type { ActivityEntry, DailyUsageRow } from "../domain/types";
import { DAY_MS } from "./time";

/**
 * Fixture data used when the app is not running inside Tauri, so `npm run dev`
 * in a plain browser renders a real-looking dashboard. Dev-only: `tauri.ts`
 * picks it up when `__TAURI_INTERNALS__` is absent.
 *
 * Deterministic per day (seeded from the day number), so the same date always
 * produces the same fixture and screenshots stay comparable.
 */

const HOUR = 3_600_000;

const APPS: Array<{ exe: string; titles: string[] }> = [
  {
    exe: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    titles: ["trackme — src/App.tsx", "trackme — src/domain/intervals.ts", "plan.md"],
  },
  {
    exe: "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
    titles: [
      "MDN — Array.prototype.at()",
      "DuckDB — Window Functions",
      "GitHub — trackme",
    ],
  },
  {
    exe: "C:\\Program Files\\WindowsApps\\WindowsTerminal.exe",
    titles: ["cargo test", "npm run tauri dev", "npm run build"],
  },
  { exe: "C:\\Program Files\\Slack\\slack.exe", titles: ["#engineering", "Direct message"] },
  { exe: "C:\\Program Files\\Spotify\\Spotify.exe", titles: ["Liked Songs"] },
  { exe: "C:\\Program Files\\Obsidian\\Obsidian.exe", titles: ["daily notes", "index"] },
  { exe: "C:\\Program Files\\Docker\\Docker Desktop.exe", titles: ["Docker Desktop"] },
  { exe: "C:\\Windows\\System32\\notepad.exe", titles: ["notes.txt"] },
  { exe: "C:\\Program Files\\Discord\\Discord.exe", titles: ["general"] },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function mockSelect(from: number, to: number): ActivityEntry[] {
  const day = from - (from % DAY_MS);
  const rand = mulberry32(day / DAY_MS);

  const entries: ActivityEntry[] = [];
  const dayEnd = day + DAY_MS;
  let cursor = day + 7 * HOUR;
  const stop = day + 23 * HOUR;
  let appIndex = Math.floor(rand() * APPS.length);

  while (cursor < stop && cursor < dayEnd) {
    const app = APPS[appIndex % APPS.length]!;
    const duration = (30 + Math.floor(rand() * 1_500)) * 1_000;
    const end = Math.min(cursor + duration, stop);
    const title = app.titles[Math.floor(rand() * app.titles.length)]!;
    entries.push([cursor, end, 1_000 + (appIndex % APPS.length), app.exe, title]);
    cursor = end;

    const roll = rand();
    if (roll < 0.12) {
      // Tracked nothing at all — a gap, which is not the same as idle.
      cursor += (60 + Math.floor(rand() * 600)) * 1_000;
    } else if (roll < 0.34) {
      const idleEnd = Math.min(cursor + (5 + Math.floor(rand() * 40)) * 60_000, stop);
      entries.push([cursor, idleEnd, 0, "idle", "afk"]);
      cursor = idleEnd;
    } else if (roll < 0.8) {
      appIndex = Math.floor(rand() * APPS.length);
    }
  }

  return entries
    .filter(([begin, end]) => end > from && begin < to)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * The range counterpart of `mockSelect`, for the historical views.
 *
 * Deliberately synthesised day-by-day rather than aggregated from `mockSelect`
 * — that only ever builds a single day and ignores `to`, so calling it over a
 * range would be both wrong and needlessly slow in the browser dev build. The
 * per-day seed keeps a given date identical across reloads.
 */
export function mockUsageDaily(from: number, to: number): DailyUsageRow[] {
  const rows: DailyUsageRow[] = [];
  const start = from - (from % DAY_MS);
  const workStart = 7 * HOUR;
  const workEnd = 23 * HOUR;
  const span = workEnd - workStart;

  for (let day = start; day < to; day += DAY_MS) {
    const rand = mulberry32(day / DAY_MS);
    if (rand() < 0.08) {
      // An untracked day — absent from the table, which is not the same as zero.
      continue;
    }

    const idleMs = Math.floor(span * (0.05 + rand() * 0.2));
    rows.push({
      dayMs: day,
      exe: "idle",
      durationMs: idleMs,
      intervalCount: 1 + Math.floor(rand() * 3),
    });

    let remaining = span - idleMs;
    const count = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < count && remaining > 0; i += 1) {
      const app = APPS[Math.floor(rand() * APPS.length)]!;
      const share = i === count - 1 ? remaining : Math.floor(remaining * (0.15 + rand() * 0.35));
      rows.push({
        dayMs: day,
        exe: app.exe,
        durationMs: share,
        intervalCount: 1 + Math.floor(rand() * 5),
      });
      remaining -= share;
    }
  }

  return rows;
}

export function mockActiveDates(): number[] {
  const today = Date.now() - (Date.now() % DAY_MS);
  const dates: number[] = [];
  for (let i = 0; i < 120; i += 1) {
    // A plausible history: most days, with a few missed.
    if (i % 9 !== 4) {
      dates.push(today - i * DAY_MS);
    }
  }
  return dates.sort((a, b) => a - b);
}

export const MOCK_CONFIG = {
  storage: { location: null },
  blacklist: ["private"],
  matchers: [{ name: "private", matcher: "title contains 'Incognito'" }],
};
