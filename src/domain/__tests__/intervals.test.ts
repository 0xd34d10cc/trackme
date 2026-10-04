import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../lib/time";
import { buildSessions, buildVisits, countAppSwitches, parseIntervals } from "../intervals";
import type { ActivityEntry } from "../types";

// An arbitrary UTC day, well away from the epoch so the arithmetic is realistic.
const DAY_START = 20_000 * DAY_MS;
const WINDOW = { from: DAY_START, to: DAY_START + DAY_MS };

let nextPid = 1;

/** A row expressed in minutes after the start of the day. */
function row(beginMin: number, endMin: number, exe: string, title = "window"): ActivityEntry {
  nextPid += 1;
  return [
    DAY_START + beginMin * 60_000,
    DAY_START + endMin * 60_000,
    nextPid,
    exe,
    title,
  ];
}

const VSCODE = "C:\\Program Files\\Microsoft VS Code\\Code.exe";
const FIREFOX = "C:\\Program Files\\Mozilla Firefox\\firefox.exe";

/** Idle is stored as a normal row with this synthetic exe. */
function idleRow(beginMin: number, endMin: number): ActivityEntry {
  return [DAY_START + beginMin * 60_000, DAY_START + endMin * 60_000, 0, "idle", "afk"];
}

describe("parseIntervals", () => {
  it("clips rows crossing a boundary and flags which edge was cut", () => {
    const rows: ActivityEntry[] = [
      // started 30 minutes before the window
      [DAY_START - 30 * 60_000, DAY_START + 20 * 60_000, 1, VSCODE, "early"],
      // runs 45 minutes past the end of the window
      [DAY_START + 100 * 60_000, DAY_START + DAY_MS + 45 * 60_000, 2, FIREFOX, "late"],
    ];

    const intervals = parseIntervals(rows, WINDOW);

    expect(intervals).toHaveLength(2);
    expect(intervals[0]).toMatchObject({
      begin: DAY_START,
      end: DAY_START + 20 * 60_000,
      clippedStart: true,
      clippedEnd: false,
    });
    expect(intervals[1]).toMatchObject({
      begin: DAY_START + 100 * 60_000,
      end: DAY_START + DAY_MS,
      clippedStart: false,
      clippedEnd: true,
    });
  });

  it("splits an overnight row between the two days it spans", () => {
    // 23:00 -> 08:00 next day, written by the tracker as a single idle row.
    const overnight: ActivityEntry[] = [
      [DAY_START + 23 * 3_600_000, DAY_START + DAY_MS + 8 * 3_600_000, 0, "idle", "afk"],
    ];

    const today = parseIntervals(overnight, WINDOW);
    const tomorrow = parseIntervals(overnight, {
      from: DAY_START + DAY_MS,
      to: DAY_START + 2 * DAY_MS,
    });

    expect(today).toHaveLength(1);
    expect(today[0]!.durationMs).toBe(3_600_000); // 23:00 -> midnight only
    expect(today[0]!.clippedEnd).toBe(true);

    expect(tomorrow).toHaveLength(1);
    expect(tomorrow[0]!.durationMs).toBe(8 * 3_600_000); // midnight -> 08:00
    expect(tomorrow[0]!.clippedStart).toBe(true);
  });

  it("drops rows that fall entirely outside the window", () => {
    const rows = [row(-120, -60, VSCODE)];
    expect(parseIntervals(rows, WINDOW)).toHaveLength(0);
  });

  it("labels idle as Idle rather than deriving it from the exe path", () => {
    const [interval] = parseIntervals([idleRow(0, 1)], WINDOW);
    expect(interval).toMatchObject({ app: "Idle", idle: true });
  });

  it("uses the executable basename as the application identity", () => {
    const [interval] = parseIntervals([row(0, 1, VSCODE)], WINDOW);
    expect(interval!.app).toBe("Code.exe");
  });
});

describe("countAppSwitches", () => {
  it("counts a direct change of application", () => {
    const intervals = parseIntervals([row(0, 10, VSCODE), row(10, 20, FIREFOX)], WINDOW);
    expect(countAppSwitches(intervals)).toBe(1);
  });

  it("does not count going idle and returning to the same application", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE), idleRow(10, 20), row(20, 30, VSCODE)],
      WINDOW,
    );
    expect(countAppSwitches(intervals)).toBe(0);
  });

  it("counts a change that passes through idle", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE), idleRow(10, 20), row(20, 30, FIREFOX)],
      WINDOW,
    );
    expect(countAppSwitches(intervals)).toBe(1);
  });

  it("does not count a window-title change within one application", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE, "a.ts"), row(10, 20, VSCODE, "b.ts")],
      WINDOW,
    );
    expect(countAppSwitches(intervals)).toBe(0);
  });

  it("does not count across a gap in tracking", () => {
    // Nothing was recorded between 10:00 and 30:00, so no switch is claimed.
    const intervals = parseIntervals([row(0, 10, VSCODE), row(30, 40, FIREFOX)], WINDOW);
    expect(countAppSwitches(intervals)).toBe(0);
  });

  it("counts each change in a longer sequence", () => {
    const intervals = parseIntervals(
      [
        row(0, 5, VSCODE),
        row(5, 10, FIREFOX),
        idleRow(10, 15),
        row(15, 20, FIREFOX),
        row(20, 25, VSCODE),
      ],
      WINDOW,
    );
    // VS Code -> Firefox -> (idle) -> Firefox -> VS Code
    expect(countAppSwitches(intervals)).toBe(2);
  });
});

describe("buildVisits", () => {
  it("merges title changes within one application into a single visit", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE, "a.ts"), row(10, 20, VSCODE, "b.ts")],
      WINDOW,
    );
    const visits = buildVisits(intervals);
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ app: "Code.exe", intervalCount: 2 });
  });

  it("ends a visit at idle, so returning to an app is a new visit", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE), idleRow(10, 20), row(20, 30, VSCODE)],
      WINDOW,
    );
    expect(buildVisits(intervals)).toHaveLength(2);
  });

  it("starts a new visit when the application changes", () => {
    const intervals = parseIntervals([row(0, 10, VSCODE), row(10, 20, FIREFOX)], WINDOW);
    expect(buildVisits(intervals)).toHaveLength(2);
  });

  it("never produces a visit for idle itself", () => {
    const intervals = parseIntervals([idleRow(0, 10), row(10, 20, VSCODE)], WINDOW);
    expect(buildVisits(intervals).map((visit) => visit.app)).toEqual(["Code.exe"]);
  });
});

describe("buildSessions", () => {
  it("keeps contiguous tracking in one session, idle included", () => {
    const intervals = parseIntervals(
      [row(0, 10, VSCODE), idleRow(10, 20), row(20, 30, VSCODE)],
      WINDOW,
    );
    expect(buildSessions(intervals)).toHaveLength(1);
  });

  it("starts a new session after a gap", () => {
    const intervals = parseIntervals([row(0, 10, VSCODE), row(30, 40, VSCODE)], WINDOW);
    expect(buildSessions(intervals)).toHaveLength(2);
  });
});
