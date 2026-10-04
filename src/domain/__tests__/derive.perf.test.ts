import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../lib/time";
import { buildSessions, buildVisits, parseIntervals } from "../intervals";
import { summarizeDay } from "../summary";
import type { ActivityEntry } from "../types";
import { usageByApp } from "../usage";

/**
 * Responsiveness guard.
 *
 * The UI is required to stay responsive, and the derivation chain is the one
 * place the frontend could accidentally become the bottleneck — so the budget
 * is asserted rather than assumed. `useDayModel` runs exactly this sequence.
 *
 * A real day is a few hundred to a few thousand intervals; the 50 000 case is a
 * pathological upper bound whose only job is to catch an accidental O(n²).
 *
 * Measured on this machine: ~1.3 ms for 2 000 intervals, ~36 ms for 50 000.
 * The budgets below keep roughly 5–8× headroom so they don't flake on a slower
 * machine, while still failing loudly on an order-of-magnitude regression.
 */

const DAY_START = 20_000 * DAY_MS;

function generate(count: number): ActivityEntry[] {
  const rows: ActivityEntry[] = [];
  let cursor = DAY_START;
  for (let index = 0; index < count; index += 1) {
    // Alternating applications every second: a worst case for visits and
    // switches, not a realistic one.
    rows.push([cursor, cursor + 1_000, 1, `C:\\apps\\app${index % 24}.exe`, `doc ${index}`]);
    cursor += 1_000;
  }
  return rows;
}

function derive(rows: ActivityEntry[]) {
  const window = { from: DAY_START, to: DAY_START + DAY_MS };
  const intervals = parseIntervals(rows, window);
  const visits = buildVisits(intervals);
  const sessions = buildSessions(intervals);
  const summary = summarizeDay(intervals, window, visits, sessions);
  const usages = usageByApp(intervals, visits);
  return { intervals, visits, sessions, summary, usages };
}

function timeDerive(rows: ActivityEntry[]): number {
  const started = performance.now();
  derive(rows);
  return performance.now() - started;
}

describe("derivation performance", () => {
  it("derives a typical day well inside a frame", () => {
    const rows = generate(2_000);
    // Warm up, then measure.
    timeDerive(rows);
    const elapsed = timeDerive(rows);

    expect(elapsed, `2 000 intervals took ${elapsed.toFixed(1)}ms`).toBeLessThan(10);
  });

  it("stays linear-ish on a pathological day", () => {
    const rows = generate(50_000);
    timeDerive(rows);
    const elapsed = timeDerive(rows);

    expect(elapsed, `50 000 intervals took ${elapsed.toFixed(1)}ms`).toBeLessThan(200);
  });
});
