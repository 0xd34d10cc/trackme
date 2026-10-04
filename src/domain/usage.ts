import { OTHER_LABEL } from "../lib/appIdentity";
import type { AppUsage, Interval, Visit } from "./types";

/**
 * Active time per application, ordered by descending duration.
 *
 * Ties break on app name so the order is stable across renders. Idle is never
 * included — it is a state, not an application.
 */
export function usageByApp(
  intervals: readonly Interval[],
  visits: readonly Visit[],
): AppUsage[] {
  const byApp = new Map<string, AppUsage>();

  for (const interval of intervals) {
    if (interval.idle) {
      continue;
    }
    const existing = byApp.get(interval.app);
    if (existing) {
      existing.activeMs += interval.durationMs;
      existing.intervalCount += 1;
      existing.firstBegin = Math.min(existing.firstBegin, interval.begin);
      existing.lastEnd = Math.max(existing.lastEnd, interval.end);
    } else {
      byApp.set(interval.app, {
        app: interval.app,
        exe: interval.exe,
        activeMs: interval.durationMs,
        intervalCount: 1,
        visitCount: 0,
        firstBegin: interval.begin,
        lastEnd: interval.end,
      });
    }
  }

  for (const visit of visits) {
    const usage = byApp.get(visit.app);
    if (usage) {
      usage.visitCount += 1;
    }
  }

  return [...byApp.values()].sort(
    (a, b) => b.activeMs - a.activeMs || a.app.localeCompare(b.app),
  );
}

/**
 * Keep the top `n` applications and roll the rest into a single "Other" row,
 * always last. `n` is capped by the caller at the palette size — a 9th hue is
 * never generated.
 */
export function topNWithOther(usages: readonly AppUsage[], n: number): AppUsage[] {
  if (usages.length <= n) {
    return [...usages];
  }

  const head = usages.slice(0, n);
  const tail = usages.slice(n);

  const other: AppUsage = {
    app: OTHER_LABEL,
    exe: "",
    activeMs: 0,
    intervalCount: 0,
    visitCount: 0,
    firstBegin: Number.POSITIVE_INFINITY,
    lastEnd: 0,
    isOther: true,
  };

  for (const usage of tail) {
    other.activeMs += usage.activeMs;
    other.intervalCount += usage.intervalCount;
    other.visitCount += usage.visitCount;
    other.firstBegin = Math.min(other.firstBegin, usage.firstBegin);
    other.lastEnd = Math.max(other.lastEnd, usage.lastEnd);
  }

  return [...head, other];
}

/** Share of the day's active time. Returns 0 when there is no active time. */
export function percentOfActive(usage: AppUsage, activeMs: number): number {
  return activeMs > 0 ? usage.activeMs / activeMs : 0;
}
