import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../lib/time";
import { buildVisits, parseIntervals } from "../intervals";
import type { ActivityEntry, Interval } from "../types";
import { percentOfActive, topNWithOther, usageByApp } from "../usage";

const DAY_START = 20_000 * DAY_MS;
const MINUTE = 60_000;

function entry(begin: number, end: number, app: string, title = "w"): ActivityEntry {
  return [DAY_START + begin * MINUTE, DAY_START + end * MINUTE, 1, `C:\\apps\\${app}`, title];
}

function intervalsOf(rows: ActivityEntry[]): Interval[] {
  return parseIntervals(rows, { from: DAY_START, to: DAY_START + DAY_MS });
}

function usagesOf(rows: ActivityEntry[]) {
  const intervals = intervalsOf(rows);
  return { intervals, usages: usageByApp(intervals, buildVisits(intervals)) };
}

describe("usageByApp", () => {
  it("sorts applications by descending active time", () => {
    const { usages } = usagesOf([
      entry(0, 10, "small.exe"),
      entry(10, 50, "big.exe"),
      entry(50, 70, "middle.exe"),
    ]);
    expect(usages.map((usage) => usage.app)).toEqual([
      "big.exe",
      "middle.exe",
      "small.exe",
    ]);
  });

  it("breaks ties on name so the order is stable", () => {
    const { usages } = usagesOf([entry(0, 10, "b.exe"), entry(10, 20, "a.exe")]);
    expect(usages.map((usage) => usage.app)).toEqual(["a.exe", "b.exe"]);
  });

  it("excludes idle from the application list", () => {
    const { usages } = usagesOf([
      entry(0, 10, "a.exe"),
      [DAY_START + 10 * MINUTE, DAY_START + 40 * MINUTE, 0, "idle", "afk"],
    ]);
    expect(usages.map((usage) => usage.app)).toEqual(["a.exe"]);
    expect(usages[0]!.activeMs).toBe(10 * MINUTE);
  });

  it("counts visits per application and spans first/last appearance", () => {
    const { usages } = usagesOf([
      entry(0, 10, "a.exe"),
      [DAY_START + 10 * MINUTE, DAY_START + 20 * MINUTE, 0, "idle", "afk"],
      entry(20, 30, "a.exe"),
    ]);
    const usage = usages[0]!;
    expect(usage.visitCount).toBe(2);
    expect(usage.intervalCount).toBe(2);
    expect(usage.firstBegin).toBe(DAY_START);
    expect(usage.lastEnd).toBe(DAY_START + 30 * MINUTE);
  });
});

describe("topNWithOther", () => {
  const rows = [
    entry(0, 100, "a.exe"),
    entry(100, 180, "b.exe"),
    entry(180, 240, "c.exe"),
    entry(240, 290, "d.exe"),
    entry(290, 330, "e.exe"),
  ];

  it("returns everything when the list already fits", () => {
    const { usages } = usagesOf(rows);
    expect(topNWithOther(usages, 10)).toHaveLength(5);
  });

  it("keeps the top N and rolls the rest into a single last row", () => {
    const { usages } = usagesOf(rows);
    const rowsOut = topNWithOther(usages, 2);
    expect(rowsOut).toHaveLength(3);
    expect(rowsOut[0]!.app).toBe("a.exe");
    expect(rowsOut[1]!.app).toBe("b.exe");
    expect(rowsOut[2]).toMatchObject({ app: "Other", isOther: true });
  });

  it("conserves total active time and interval count", () => {
    const { intervals, usages } = usagesOf(rows);
    const activeMs = intervals.reduce(
      (total, interval) => total + (interval.idle ? 0 : interval.durationMs),
      0,
    );
    const intervalCount = intervals.filter((interval) => !interval.idle).length;

    const rowsOut = topNWithOther(usages, 2);
    const summed = rowsOut.reduce((total, usage) => total + usage.activeMs, 0);
    const summedIntervals = rowsOut.reduce(
      (total, usage) => total + usage.intervalCount,
      0,
    );

    expect(summed).toBe(activeMs);
    expect(summedIntervals).toBe(intervalCount);
  });
});

describe("percentOfActive", () => {
  it("sums to 100% across the applications", () => {
    const rows = [
      entry(0, 50, "a.exe"),
      entry(50, 80, "b.exe"),
      entry(80, 100, "c.exe"),
    ];
    const { usages } = usagesOf(rows);
    const activeMs = usages.reduce((total, usage) => total + usage.activeMs, 0);
    const total = usages.reduce(
      (sum, usage) => sum + percentOfActive(usage, activeMs),
      0,
    );
    expect(total).toBeCloseTo(1, 10);
  });

  it("returns zero rather than dividing by zero", () => {
    const { usages } = usagesOf([entry(0, 10, "a.exe")]);
    expect(percentOfActive(usages[0]!, 0)).toBe(0);
  });
});
