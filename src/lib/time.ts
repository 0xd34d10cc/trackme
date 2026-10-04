/**
 * Time helpers.
 *
 * The whole app assumes the machine runs in **UTC** (see CLAUDE.md). Every
 * "day" is therefore a UTC day and every day is exactly DAY_MS long — there is
 * no DST to handle, and the arithmetic below is deliberately trivial.
 *
 * This matches the backend: `select_active_dates.sql` buckets rows by
 * `begin_ms % 86400000`, i.e. UTC midnights, and returns UTC-midnight epoch ms.
 * Anything that buckets time differently will disagree with it.
 */

export const DAY_MS = 86_400_000;

/** Epoch ms of the UTC midnight at or before `ms`. */
export function startOfUtcDay(ms: number): number {
  return ms - (ms % DAY_MS);
}

export interface DayWindow {
  /** Inclusive, epoch ms. */
  from: number;
  /** Exclusive, epoch ms. */
  to: number;
}

/** The half-open window [from, to) covering the UTC day containing `dateMs`. */
export function dayWindow(dateMs: number): DayWindow {
  const from = startOfUtcDay(dateMs);
  return { from, to: from + DAY_MS };
}

export function addDays(ms: number, days: number): number {
  return ms + days * DAY_MS;
}

/**
 * The window used for *totals*, as opposed to rendering.
 *
 * For a finished day this is the whole day. For today it is capped at `now` —
 * otherwise an 08:00 view would report the remaining 16 hours as "untracked",
 * which reads as if the tracker had been broken all day.
 */
export function totalWindow(dateMs: number, now: number = Date.now()): DayWindow {
  const { from, to } = dayWindow(dateMs);
  return { from, to: Math.min(to, Math.max(now, from)) };
}

export function isSameUtcDay(a: number, b: number): boolean {
  return startOfUtcDay(a) === startOfUtcDay(b);
}
