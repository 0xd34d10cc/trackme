import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../lib/time";
import { buildSessions, buildVisits, parseIntervals } from "../intervals";
import { summarizeDay } from "../summary";
import type { ActivityEntry } from "../types";

const DAY_START = 20_000 * DAY_MS;
const FULL_DAY = { from: DAY_START, to: DAY_START + DAY_MS };

const MINUTE = 60_000;
const VSCODE = "C:\\Program Files\\Microsoft VS Code\\Code.exe";
const FIREFOX = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";

function minute(begin: number, end: number, exe: string): ActivityEntry {
  return [DAY_START + begin * MINUTE, DAY_START + end * MINUTE, 1, exe, "window"];
}

function idleMinute(begin: number, end: number): ActivityEntry {
  return [DAY_START + begin * MINUTE, DAY_START + end * MINUTE, 0, "idle", "afk"];
}

function build(rows: ActivityEntry[], window = FULL_DAY) {
  const intervals = parseIntervals(rows, { from: DAY_START, to: DAY_START + DAY_MS });
  const visits = buildVisits(intervals);
  const sessions = buildSessions(intervals);
  return summarizeDay(intervals, window, visits, sessions);
}

describe("summarizeDay", () => {
  const rows = [
    minute(0, 60, VSCODE), // 60m active
    idleMinute(60, 120), // 60m idle
    minute(120, 180, FIREFOX), // 60m active
    // nothing recorded after 03:00 — a gap, not idle
  ];

  it("separates active, idle and tracked time", () => {
    const summary = build(rows);
    expect(summary.activeMs).toBe(120 * MINUTE);
    expect(summary.idleMs).toBe(60 * MINUTE);
    expect(summary.trackedMs).toBe(180 * MINUTE);
  });

  it("treats unrecorded time as untracked, never as idle", () => {
    const summary = build(rows);
    expect(summary.untrackedMs).toBe(DAY_MS - 180 * MINUTE);
    expect(summary.untrackedMs).not.toBe(summary.idleMs);
  });

  it("counts non-idle intervals separately from idle ones", () => {
    const summary = build(rows);
    expect(summary.intervalCount).toBe(2);
    expect(summary.idleIntervalCount).toBe(1);
    expect(summary.totalIntervalCount).toBe(3);
  });

  it("reports switches, visits, sessions and distinct applications", () => {
    const summary = build(rows);
    expect(summary.appSwitchCount).toBe(1); // Code -> (idle) -> Firefox
    expect(summary.visitCount).toBe(2);
    expect(summary.sessionCount).toBe(1); // contiguous throughout
    expect(summary.distinctAppCount).toBe(2);
  });

  it("expresses coverage relative to the totalled window", () => {
    const summary = build(rows);
    expect(summary.coverage).toBeCloseTo((180 * MINUTE) / DAY_MS, 6);
  });

  it("uses the capped window for today so the rest of the day is not 'untracked'", () => {
    // Only the first two hours have elapsed.
    const window = { from: DAY_START, to: DAY_START + 120 * MINUTE };
    const summary = build(rows, window);
    expect(summary.windowMs).toBe(120 * MINUTE);
    expect(summary.activeMs).toBe(60 * MINUTE);
    expect(summary.untrackedMs).toBe(0);
    expect(summary.coverage).toBe(1);
  });

  it("never reports negative untracked time when rows overlap the window oddly", () => {
    const summary = build(rows, { from: DAY_START, to: DAY_START + 10 * MINUTE });
    expect(summary.untrackedMs).toBeGreaterThanOrEqual(0);
    expect(summary.coverage).toBeLessThanOrEqual(1);
  });
});
