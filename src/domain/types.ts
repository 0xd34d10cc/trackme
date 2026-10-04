/**
 * Domain types for the daily activity model.
 *
 * Nothing here imports React, `invoke`, or MUI — this layer is pure so it can
 * be unit-tested directly and reused by every future view.
 */

/** One row from `select`, as serialized by the Rust `Entry`: a 5-tuple. */
export type ActivityEntry = [
  beginMs: number,
  endMs: number,
  pid: number,
  exe: string,
  title: string,
];

/** A stored row, clipped to the day window and pre-resolved for display. */
export interface Interval {
  /** Epoch ms, clipped to the window. */
  begin: number;
  /** Epoch ms, clipped to the window. Exclusive. */
  end: number;
  pid: number;
  /** The raw executable path as reported by the backend. */
  exe: string;
  /** Display identity: the basename of `exe`, or the idle label. */
  app: string;
  title: string;
  idle: boolean;
  durationMs: number;
  /** True when the row began before the window and was clipped. */
  clippedStart: boolean;
  /** True when the row ends after the window and was clipped. */
  clippedEnd: boolean;
}

/**
 * A maximal run of consecutive intervals in the same application.
 * Title changes within one app merge into a single visit; an app change, an
 * idle interval, or an untracked gap ends one.
 */
export interface Visit {
  app: string;
  begin: number;
  end: number;
  durationMs: number;
  intervalCount: number;
}

/** A maximal gapless run of intervals — i.e. one continuous stretch of tracking. */
export interface Session {
  begin: number;
  end: number;
  durationMs: number;
  intervals: Interval[];
}

/** Aggregate for one application over the window. Idle is never included. */
export interface AppUsage {
  app: string;
  exe: string;
  activeMs: number;
  intervalCount: number;
  visitCount: number;
  firstBegin: number;
  lastEnd: number;
  /** True for the rolled-up "Other" row produced by `topNWithOther`. */
  isOther?: boolean;
}

/** One row from `usage_daily`, matching the Rust `DailyUsage` (camelCase). */
export interface DailyUsageRow {
  /** UTC midnight of the day, epoch ms. */
  dayMs: number;
  /** Raw executable path; the literal `"idle"` for idle blocks. */
  exe: string;
  /** Recorded duration, clipped to the queried window. */
  durationMs: number;
  /** Number of activity rows on this day for this exe. */
  intervalCount: number;
}

export interface DaySummary {
  /** Length of the totalled window: the whole day, or up to "now" for today. */
  windowMs: number;
  /** Every recorded interval, idle included. */
  trackedMs: number;
  idleMs: number;
  /** tracked − idle. The headline number, and the percentage denominator. */
  activeMs: number;
  /**
   * window − tracked. NOT idle: this is time the tracker did not record at all
   * (app closed, or the activity was blacklisted). Never present it as idle.
   */
  untrackedMs: number;
  /** Non-idle intervals. */
  intervalCount: number;
  idleIntervalCount: number;
  totalIntervalCount: number;
  appSwitchCount: number;
  visitCount: number;
  sessionCount: number;
  distinctAppCount: number;
  /** tracked / window, clamped to 1. */
  coverage: number;
}
