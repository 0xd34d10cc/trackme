import type { DayWindow } from "../lib/time";
import { countAppSwitches } from "./intervals";
import type { DaySummary, Interval, Session, Visit } from "./types";

/**
 * Totals for one day. `window` is the *totalled* window, which for today is
 * capped at "now" (see `totalWindow`).
 */
export function summarizeDay(
  intervals: readonly Interval[],
  window: DayWindow,
  visits: readonly Visit[],
  sessions: readonly Session[],
): DaySummary {
  const windowMs = Math.max(0, window.to - window.from);

  let trackedMs = 0;
  let idleMs = 0;
  let intervalCount = 0;
  let idleIntervalCount = 0;
  const apps = new Set<string>();

  for (const interval of intervals) {
    trackedMs += interval.durationMs;
    if (interval.idle) {
      idleIntervalCount += 1;
    } else {
      intervalCount += 1;
      apps.add(interval.app);
    }
  }

  for (const interval of intervals) {
    if (interval.idle) {
      idleMs += interval.durationMs;
    }
  }

  // Rows should never overlap (the tracker writes contiguous, non-overlapping
  // entries), but clamp anyway so a bad row can't produce a negative
  // "untracked" or a coverage above 100%.
  const boundedTracked = Math.min(trackedMs, windowMs);

  return {
    windowMs,
    trackedMs,
    idleMs: Math.min(idleMs, boundedTracked),
    activeMs: Math.max(0, boundedTracked - idleMs),
    untrackedMs: Math.max(0, windowMs - trackedMs),
    intervalCount,
    idleIntervalCount,
    totalIntervalCount: intervals.length,
    appSwitchCount: countAppSwitches(intervals),
    visitCount: visits.length,
    sessionCount: sessions.length,
    distinctAppCount: apps.size,
    coverage: windowMs > 0 ? Math.min(1, trackedMs / windowMs) : 0,
  };
}
