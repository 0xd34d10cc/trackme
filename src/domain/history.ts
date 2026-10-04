/**
 * Historical analysis over a date range.
 *
 * The backend hands us one compact row per (UTC day, exe); everything the range
 * views need is a grouping of that single table. Idle is a normal exe
 * (`"idle"`) here exactly as it is everywhere else, and is excluded from
 * "active" figures and from the stacked chart rather than treated as a flag.
 *
 * Pure: no React, no `invoke`, no MUI. Every function takes and returns plain
 * data so it can be unit-tested directly.
 */

import { appName, isIdleExe, OTHER_LABEL } from "../lib/appIdentity";
import { eachDay } from "../lib/time";
import type { DailyUsageRow } from "./types";

/** Recorded time for one UTC day. Idle is separated out of `activeMs`. */
export interface DayTotal {
  dayMs: number;
  activeMs: number;
  idleMs: number;
  trackedMs: number;
  intervalCount: number;
}

/** One application's totals across a range. Idle is never included. */
export interface AppTotal {
  app: string;
  /** A representative raw exe path; identity is the basename. */
  exe: string;
  activeMs: number;
  intervalCount: number;
  /** Distinct days on which the app was active. */
  activeDays: number;
  firstDayMs: number;
  lastDayMs: number;
}

/**
 * The headline figures for one focus — everything in the range, or a single
 * application. `dayCount` counts every day in the range (the denominator for
 * the per-day average); `activeDays` counts only the days the focus was
 * actually used.
 */
export interface FocusStats {
  activeMs: number;
  activeDays: number;
  dayCount: number;
  /** `activeMs / dayCount`. */
  perDayMs: number;
  /** `activeMs / activeDays`; zero when nothing was active. */
  perActiveDayMs: number;
}

/** One row of a stacked bar: an application and its per-day values. */
export interface StackedSeries {
  app: string;
  /** Dense — one value per day in the range, zero-filled. */
  values: number[];
}

export interface DailyStacks {
  /** The UTC midnights the values are aligned to. */
  days: number[];
  /** Draw order: the top applications, then "Other" when anything remains. */
  series: StackedSeries[];
  /** The stack's height per day. */
  totals: number[];
}

/** A private accumulator so `activeDays` can be a real distinct-day count. */
interface AppAcc extends Omit<AppTotal, "activeDays"> {
  days: Set<number>;
}

/** Every UTC day in [from, to), gap-filled with zeros. */
export function perDayTotals(
  rows: readonly DailyUsageRow[],
  from: number,
  to: number,
): DayTotal[] {
  const byDay = new Map<number, DayTotal>();
  for (const dayMs of eachDay(from, to)) {
    byDay.set(dayMs, { dayMs, activeMs: 0, idleMs: 0, trackedMs: 0, intervalCount: 0 });
  }

  for (const row of rows) {
    const total = byDay.get(row.dayMs);
    if (!total) {
      continue;
    }
    total.intervalCount += row.intervalCount;
    if (isIdleExe(row.exe)) {
      total.idleMs += row.durationMs;
    } else {
      total.activeMs += row.durationMs;
    }
    total.trackedMs = total.activeMs + total.idleMs;
  }

  return [...byDay.values()];
}

/** Applications by descending active time, idle excluded, ties on name. */
export function perAppTotals(rows: readonly DailyUsageRow[]): AppTotal[] {
  const byApp = new Map<string, AppAcc>();

  for (const row of rows) {
    if (isIdleExe(row.exe)) {
      continue;
    }
    const app = appName(row.exe);
    let total = byApp.get(app);
    if (!total) {
      total = {
        app,
        exe: row.exe,
        activeMs: 0,
        intervalCount: 0,
        firstDayMs: row.dayMs,
        lastDayMs: row.dayMs,
        days: new Set(),
      };
      byApp.set(app, total);
    }
    total.activeMs += row.durationMs;
    total.intervalCount += row.intervalCount;
    total.days.add(row.dayMs);
    total.firstDayMs = Math.min(total.firstDayMs, row.dayMs);
    total.lastDayMs = Math.max(total.lastDayMs, row.dayMs);
  }

  return [...byApp.values()]
    .map(({ days, ...total }) => ({ ...total, activeDays: days.size }))
    .sort((a, b) => b.activeMs - a.activeMs || a.app.localeCompare(b.app));
}

/** Active time per day for every application, as a lookup of dense arrays. */
function activeByAppPerDay(
  rows: readonly DailyUsageRow[],
  days: readonly number[],
): Map<string, number[]> {
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const perApp = new Map<string, number[]>();

  for (const row of rows) {
    if (isIdleExe(row.exe)) {
      continue;
    }
    const index = dayIndex.get(row.dayMs);
    if (index === undefined) {
      continue;
    }
    const app = appName(row.exe);
    let values = perApp.get(app);
    if (values === undefined) {
      values = new Array<number>(days.length).fill(0);
      perApp.set(app, values);
    }
    values[index] = values[index]! + row.durationMs;
  }

  return perApp;
}

/**
 * The day-by-application stack for the History chart.
 *
 * Each day picks its **own** `topN` busiest applications, so the union of the
 * drawn series is usually far larger than `topN` — an application that is only
 * busy on some days appears as a segment on those days and contributes to the
 * "Other" segment on the rest. Every day's stack therefore sums to that day's
 * total active time.
 *
 * Filtered to one application, it is a single series: every other application
 * is dropped, and `totals` becomes that application's own daily series.
 */
export function dailyAppStacks(
  rows: readonly DailyUsageRow[],
  from: number,
  to: number,
  topN: number,
  filter: string | null = null,
): DailyStacks {
  const days = eachDay(from, to);
  const perApp = activeByAppPerDay(rows, days);

  if (filter !== null) {
    const values = perApp.get(filter) ?? new Array<number>(days.length).fill(0);
    return { days, series: [{ app: filter, values }], totals: [...values] };
  }

  const totals = new Array<number>(days.length).fill(0);
  for (const values of perApp.values()) {
    for (let index = 0; index < days.length; index += 1) {
      totals[index] += values[index]!;
    }
  }

  const drawn = new Map<string, number[]>();
  const other = new Array<number>(days.length).fill(0);

  for (let index = 0; index < days.length; index += 1) {
    const ranked = [...perApp.entries()]
      .map(([app, values]) => ({ app, value: values[index]! }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.app.localeCompare(b.app))
      .slice(0, topN);

    let accounted = 0;
    for (const entry of ranked) {
      let values = drawn.get(entry.app);
      if (values === undefined) {
        values = new Array<number>(days.length).fill(0);
        drawn.set(entry.app, values);
      }
      values[index] = entry.value;
      accounted += entry.value;
    }
    // Whatever this day's top N left unaccounted for.
    other[index] = totals[index]! - accounted;
  }

  const series: StackedSeries[] = [...drawn.entries()]
    .map(([app, values]) => ({
      app,
      values,
      drawnMs: values.reduce((sum, value) => sum + value, 0),
    }))
    // Biggest contributors first, so the legend reads like a ranking.
    .sort((a, b) => b.drawnMs - a.drawnMs || a.app.localeCompare(b.app))
    .map(({ app, values }) => ({ app, values }));

  if (other.some((value) => value > 0)) {
    series.push({ app: OTHER_LABEL, values: other });
  }

  return { days, series, totals };
}

/**
 * Trailing mean over up to `window` points, including the current one. The
 * early points average a partial window, so the line starts on day one instead
 * of after a full window's lag.
 */
export function rollingAverage(values: readonly number[], window: number): number[] {
  const size = Math.max(1, Math.floor(window));
  const out: number[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]!;
    if (index >= size) {
      sum -= values[index - size]!;
    }
    out.push(sum / Math.min(index + 1, size));
  }
  return out;
}

/**
 * Summarise the current focus over a range.
 *
 * Takes the already-derived tables rather than the raw rows, so switching the
 * filter re-uses the model's memoised per-day and per-app work instead of
 * re-scanning the range.
 */
export function focusStats(
  dayTotals: readonly DayTotal[],
  appTotals: readonly AppTotal[],
  app: string | null = null,
): FocusStats {
  let activeMs = 0;
  let activeDays = 0;

  if (app === null) {
    for (const day of dayTotals) {
      activeMs += day.activeMs;
      if (day.activeMs > 0) {
        activeDays += 1;
      }
    }
  } else {
    const total = appTotals.find((entry) => entry.app === app);
    activeMs = total?.activeMs ?? 0;
    activeDays = total?.activeDays ?? 0;
  }

  const dayCount = dayTotals.length;
  return {
    activeMs,
    activeDays,
    dayCount,
    perDayMs: dayCount > 0 ? activeMs / dayCount : 0,
    perActiveDayMs: activeDays > 0 ? activeMs / activeDays : 0,
  };
}
