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

// ---------------------------------------------------------------------------
// Ranges.
//
// Deliberately UTC-only, for the same reason as everything else in this file:
// the backend buckets by UTC day, so a range computed in local time would
// disagree with it.
// ---------------------------------------------------------------------------

/** Snap a raw [from, to) onto UTC-day boundaries. Empty ranges widen to one day. */
export function rangeWindow(fromMs: number, toMs: number): DayWindow {
  const from = startOfUtcDay(fromMs);
  const to = startOfUtcDay(toMs);
  return to > from ? { from, to } : { from, to: from + DAY_MS };
}

/** Number of whole UTC days in [from, to). */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.round((to - from) / DAY_MS));
}

/** Every UTC midnight in [from, to), ascending. */
export function eachDay(from: number, to: number): number[] {
  const days: number[] = [];
  for (let ms = startOfUtcDay(from); ms < to; ms += DAY_MS) {
    days.push(ms);
  }
  return days;
}

export type RangePreset = "7d" | "30d" | "90d" | "mtd" | "ytd";

const PRESET_DAYS: Record<"7d" | "30d" | "90d", number> = { "7d": 7, "30d": 30, "90d": 90 };

function startOfUtcMonth(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** A preset window ending on today (inclusive), i.e. today is the last day in it. */
export function presetRange(preset: RangePreset, now: number = Date.now()): DayWindow {
  const today = startOfUtcDay(now);
  const to = today + DAY_MS;
  switch (preset) {
    case "7d":
    case "30d":
    case "90d":
      return { from: today - (PRESET_DAYS[preset] - 1) * DAY_MS, to };
    case "mtd":
      return { from: startOfUtcMonth(now), to };
    case "ytd":
      return { from: Date.UTC(new Date(now).getUTCFullYear(), 0, 1), to };
  }
}

/**
 * Keep a range inside the recorded window: no day in the future, and at most
 * `maxDays` long. Returns null when nothing survives (a wholly-future range).
 */
export function clampRange(
  range: DayWindow,
  now: number = Date.now(),
  maxDays = 370,
): DayWindow | null {
  const latest = startOfUtcDay(now) + DAY_MS;
  const to = Math.min(startOfUtcDay(range.to), latest);
  let from = startOfUtcDay(range.from);
  if (to - from > maxDays * DAY_MS) {
    from = to - maxDays * DAY_MS;
  }
  return to > from ? { from, to } : null;
}
