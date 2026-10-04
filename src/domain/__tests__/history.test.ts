import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../lib/time";
import {
  busiestDay,
  dailyAppStacks,
  focusStats,
  perAppTotals,
  perDayTotals,
} from "../history";
import type { DailyUsageRow } from "../types";

const HOUR = 3_600_000;
/** An arbitrary UTC midnight. 20 000 * DAY_MS lands on a Friday. */
const DAY0 = 20_000 * DAY_MS;
const IDLE = "idle";
const A = "C:\\Program Files\\Alpha\\alpha.exe";
const A_ALT = "\\Device\\HarddiskVolume2\\Other\\alpha.exe";
const B = "C:\\Program Files\\Beta\\beta.exe";

function row(dayMs: number, exe: string, durationMs: number, intervalCount = 1): DailyUsageRow {
  return { dayMs, exe, durationMs, intervalCount };
}

describe("perDayTotals", () => {
  it("separates active from idle and gap-fills absent days", () => {
    const rows = [
      row(DAY0, A, HOUR),
      row(DAY0, IDLE, 2 * HOUR),
      row(DAY0 + 2 * DAY_MS, B, 3 * HOUR),
    ];

    expect(perDayTotals(rows, DAY0, DAY0 + 3 * DAY_MS)).toEqual([
      { dayMs: DAY0, activeMs: HOUR, idleMs: 2 * HOUR, trackedMs: 3 * HOUR, intervalCount: 2 },
      { dayMs: DAY0 + DAY_MS, activeMs: 0, idleMs: 0, trackedMs: 0, intervalCount: 0 },
      {
        dayMs: DAY0 + 2 * DAY_MS,
        activeMs: 3 * HOUR,
        idleMs: 0,
        trackedMs: 3 * HOUR,
        intervalCount: 1,
      },
    ]);
  });
});

describe("perAppTotals", () => {
  it("excludes idle, merges by basename, and sorts by active time", () => {
    const rows = [
      row(DAY0, A, HOUR),
      row(DAY0 + DAY_MS, A_ALT, 2 * HOUR),
      row(DAY0, B, 5 * HOUR),
      row(DAY0, IDLE, 9 * HOUR),
    ];

    const totals = perAppTotals(rows);

    expect(totals.map((total) => total.app)).toEqual(["beta.exe", "alpha.exe"]);
    expect(totals[0]).toMatchObject({ activeMs: 5 * HOUR, activeDays: 1 });
    // Two paths with the same basename are one application.
    expect(totals[1]).toMatchObject({ activeMs: 3 * HOUR, activeDays: 2, intervalCount: 2 });
    expect(totals[1]!.firstDayMs).toBe(DAY0);
    expect(totals[1]!.lastDayMs).toBe(DAY0 + DAY_MS);
  });
});

describe("dailyAppStacks", () => {
  // The busiest application flips between the two days: beta leads day 0,
  // alpha leads day 1. Overall alpha 5h, beta 8h.
  const rows = [
    row(DAY0, A, HOUR),
    row(DAY0, B, 5 * HOUR),
    row(DAY0 + DAY_MS, A, 4 * HOUR),
    row(DAY0 + DAY_MS, B, 3 * HOUR),
    row(DAY0, IDLE, 9 * HOUR),
  ];
  const range = [DAY0, DAY0 + 2 * DAY_MS] as const;

  it("picks each day's own busiest applications, not the range's", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 1);

    expect(stacks.days).toEqual([DAY0, DAY0 + DAY_MS]);
    // Two drawn series from a topN of one — the selection is per day, so the
    // chart's series count grows with the number of days, not with topN.
    expect(stacks.series.map((entry) => entry.app)).toEqual([
      "beta.exe",
      "alpha.exe",
      "Other",
    ]);
    // beta is day 0's pick and alpha day 1's; neither is drawn on the other day.
    expect(stacks.series[0]!.values).toEqual([5 * HOUR, 0]);
    expect(stacks.series[1]!.values).toEqual([0, 4 * HOUR]);
    // The hours left on the table fall into that day's Other.
    expect(stacks.series[2]!.values).toEqual([HOUR, 3 * HOUR]);
  });

  it("makes each day's stack sum to that day's active time", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 1);
    expect(stacks.totals).toEqual([6 * HOUR, 7 * HOUR]);
  });

  it("omits Other when a day has no more than topN applications", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 5);
    expect(stacks.series.map((entry) => entry.app)).toEqual(["beta.exe", "alpha.exe"]);
    expect(stacks.totals).toEqual([6 * HOUR, 7 * HOUR]);
  });

  it("never stacks idle", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 5);
    expect(stacks.series.some((entry) => entry.app === "Idle")).toBe(false);
  });

  it("narrows to a single application when filtered", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 1, "alpha.exe");
    expect(stacks.series).toHaveLength(1);
    expect(stacks.series[0]!.app).toBe("alpha.exe");
    expect(stacks.series[0]!.values).toEqual([HOUR, 4 * HOUR]);
    expect(stacks.totals).toEqual([HOUR, 4 * HOUR]);
  });

  it("yields an empty stack when the filter matches nothing", () => {
    const stacks = dailyAppStacks(rows, range[0], range[1], 1, "missing.exe");
    expect(stacks.totals).toEqual([0, 0]);
  });
});

describe("busiestDay", () => {
  const days = [DAY0, DAY0 + DAY_MS, DAY0 + 2 * DAY_MS];

  it("returns the largest day with its date", () => {
    expect(busiestDay(days, [HOUR, 5 * HOUR, 3 * HOUR])).toEqual({
      dayMs: DAY0 + DAY_MS,
      activeMs: 5 * HOUR,
    });
  });

  it("ignores zero days and returns null when nothing was active", () => {
    expect(busiestDay(days, [0, 0, 0])).toBeNull();
    expect(busiestDay([], [])).toBeNull();
    expect(busiestDay(days, [0, 2 * HOUR, 0])?.dayMs).toBe(DAY0 + DAY_MS);
  });

  it("keeps the earliest day on a tie", () => {
    expect(busiestDay(days, [HOUR, HOUR, 0])?.dayMs).toBe(DAY0);
  });
});

describe("focusStats", () => {
  // Four days in range; two of them have activity. alpha 3h over two days,
  // beta 3h on one day, and an idle block that is nobody's active time.
  const rows = [
    row(DAY0, A, HOUR),
    row(DAY0, B, 3 * HOUR),
    row(DAY0, IDLE, 9 * HOUR),
    row(DAY0 + 2 * DAY_MS, A, 2 * HOUR),
  ];
  const from = DAY0;
  const to = DAY0 + 4 * DAY_MS;

  const stats = (app: string | null) =>
    focusStats(perDayTotals(rows, from, to), perAppTotals(rows), app);

  it("summarises every application when unfiltered", () => {
    expect(stats(null)).toMatchObject({ activeMs: 6 * HOUR, activeDays: 2, dayCount: 4 });
    expect(stats(null).perActiveDayMs).toBeCloseTo((6 * HOUR) / 2);
  });

  it("re-bases every figure on one application when filtered", () => {
    expect(stats("alpha.exe")).toMatchObject({ activeMs: 3 * HOUR, activeDays: 2, dayCount: 4 });
    expect(stats("alpha.exe").perActiveDayMs).toBeCloseTo((3 * HOUR) / 2);

    // beta is busy on a single day only, so its average is its whole total.
    expect(stats("beta.exe")).toMatchObject({ activeMs: 3 * HOUR, activeDays: 1 });
    expect(stats("beta.exe").perActiveDayMs).toBeCloseTo(3 * HOUR);
  });

  it("is all zeros for an application with no activity in the range", () => {
    expect(stats("missing.exe")).toMatchObject({
      activeMs: 0,
      activeDays: 0,
      perActiveDayMs: 0,
    });
  });
});
