import { IDLE_LABEL, appName, isIdleExe } from "../lib/appIdentity";
import type { DayWindow } from "../lib/time";
import type { ActivityEntry, Interval, Session, Visit } from "./types";

/**
 * Two intervals count as adjacent when the gap between them is at most this.
 * The tracker samples once a second, so consecutive rows can be a few ms apart
 * for reasons that are not a real interruption.
 */
export const GAP_TOLERANCE_MS = 1_000;

/**
 * Convert raw rows into display intervals, clipped to `window`.
 *
 * Clipping matters: `select` uses an overlap predicate so that rows crossing a
 * day boundary (an overnight idle block is written as a single 23:00→08:00 row)
 * are returned rather than silently dropped. Each such row is then attributed
 * to each day for exactly the part that falls inside it.
 */
export function parseIntervals(
  rows: readonly ActivityEntry[],
  window: DayWindow,
): Interval[] {
  const intervals: Interval[] = [];

  for (const [rowBegin, rowEnd, pid, exe, title] of rows) {
    const begin = Math.max(rowBegin, window.from);
    const end = Math.min(rowEnd, window.to);
    if (end <= begin) {
      continue;
    }

    const idle = isIdleExe(exe);
    intervals.push({
      begin,
      end,
      pid,
      exe,
      app: idle ? IDLE_LABEL : appName(exe),
      title,
      idle,
      durationMs: end - begin,
      clippedStart: rowBegin < window.from,
      clippedEnd: rowEnd > window.to,
    });
  }

  intervals.sort((a, b) => a.begin - b.begin || a.end - b.end);
  return intervals;
}

/** Maximal runs of the same application, with gaps ≤ GAP_TOLERANCE_MS bridged. */
export function buildVisits(intervals: readonly Interval[]): Visit[] {
  const visits: Visit[] = [];
  let current: Visit | null = null;
  let previousEnd: number | null = null;

  for (const interval of intervals) {
    const adjacent =
      previousEnd !== null && interval.begin - previousEnd <= GAP_TOLERANCE_MS;

    // Idle is a state, not an application, so it ends the current visit.
    if (interval.idle || !current || !adjacent || current.app !== interval.app) {
      if (current) {
        visits.push(current);
      }
      current = interval.idle
        ? null
        : {
            app: interval.app,
            begin: interval.begin,
            end: interval.end,
            durationMs: interval.durationMs,
            intervalCount: 1,
          };
    } else {
      current.end = interval.end;
      current.durationMs = current.end - current.begin;
      current.intervalCount += 1;
    }

    previousEnd = interval.end;
  }

  if (current) {
    visits.push(current);
  }

  return visits;
}

/**
 * Maximal gapless runs of tracking, idle included — a session is "the tracker
 * was recording continuously", not "the user was working".
 */
export function buildSessions(intervals: readonly Interval[]): Session[] {
  const sessions: Session[] = [];
  let bucket: Interval[] = [];
  let previousEnd: number | null = null;

  const flush = () => {
    if (bucket.length === 0) {
      return;
    }
    const first = bucket[0]!;
    const last = bucket[bucket.length - 1]!;
    sessions.push({
      begin: first.begin,
      end: last.end,
      durationMs: last.end - first.begin,
      intervals: bucket,
    });
    bucket = [];
  };

  for (const interval of intervals) {
    const adjacent =
      previousEnd !== null && interval.begin - previousEnd <= GAP_TOLERANCE_MS;
    if (previousEnd !== null && !adjacent) {
      flush();
    }
    bucket.push(interval);
    previousEnd = interval.end;
  }

  flush();
  return sessions;
}

/**
 * How many times the foreground application changed.
 *
 * Definition (the interesting cases are the ones involving idle and gaps):
 *   A→B              1
 *   A→idle→A         0   (going AFK and coming back is not a switch)
 *   A→idle→B         1   (idle is transparent, not an application)
 *   tab change       0   (same app, different title)
 *   A→[gap]→B        0   (nothing was recorded in between, so nothing is
 *                         claimed about what happened — a gap is not a switch)
 */
export function countAppSwitches(intervals: readonly Interval[]): number {
  let switches = 0;
  let lastApp: string | null = null;
  let previousEnd: number | null = null;

  for (const interval of intervals) {
    const adjacent =
      previousEnd !== null && interval.begin - previousEnd <= GAP_TOLERANCE_MS;

    // A gap means the sequence is broken: whatever happened next cannot be
    // compared against what came before.
    if (!adjacent) {
      lastApp = null;
    }

    if (!interval.idle) {
      if (lastApp !== null && lastApp !== interval.app) {
        switches += 1;
      }
      lastApp = interval.app;
    }

    previousEnd = interval.end;
  }

  return switches;
}
