import { useColorScheme } from "@mui/material/styles";
import { useMemo } from "react";
import {
  buildSessions,
  buildVisits,
  parseIntervals,
} from "../../domain/intervals";
import { summarizeDay } from "../../domain/summary";
import type {
  ActivityEntry,
  AppUsage,
  DaySummary,
  Interval,
  Session,
  Visit,
} from "../../domain/types";
import { topNWithOther, usageByApp } from "../../domain/usage";
import type { ColorMode } from "../palette";
import { startOfUtcDay, totalWindow, type DayWindow } from "../time";
import { useActivities } from "./useActivities";

/**
 * Everything the daily dashboard needs, derived **once**.
 *
 * The summary tiles, the application breakdown and the timeline all read this
 * same object. If each computed its own aggregates from the raw rows, that
 * would be the most likely accidental bottleneck in the app — so it is designed
 * out rather than optimised later.
 */
export interface DayModel {
  /** The whole day — what the timeline's axis spans. */
  renderWindow: DayWindow;
  /** The totalled window: the whole day, or up to "now" when it is today. */
  totalWindow: DayWindow;
  intervals: Interval[];
  visits: Visit[];
  sessions: Session[];
  summary: DaySummary;
  /** Every application, sorted by active time descending. */
  usages: AppUsage[];
  /** Top N plus an "Other" roll-up — what the charts draw. */
  selectedUsages: AppUsage[];
  /**
   * The active colour scheme. Colours themselves are not stored here — they
   * are derived from the application name by `appColor(app, mode)`, so they
   * never depend on the day's data or on what else is on screen.
   */
  mode: ColorMode;
  /** True when the rendered day is today (so new data keeps arriving). */
  isToday: boolean;
}

function buildDayModel(
  entries: readonly ActivityEntry[],
  renderWindow: DayWindow,
  topN: number,
  mode: ColorMode,
  now: number,
): DayModel {
  const intervals = parseIntervals(entries, renderWindow);
  const visits = buildVisits(intervals);
  const sessions = buildSessions(intervals);
  const total = totalWindow(renderWindow.from, now);
  const summary = summarizeDay(intervals, total, visits, sessions);
  const usages = usageByApp(intervals, visits);

  return {
    renderWindow,
    totalWindow: total,
    intervals,
    visits,
    sessions,
    summary,
    usages,
    selectedUsages: topNWithOther(usages, topN),
    mode,
    isToday: renderWindow.from === startOfUtcDay(now),
  };
}

/**
 * Fetch and derive one day. Memoised on the query data reference, which is
 * stable for as long as the cache entry is — and independent of `selectedApp`,
 * so selecting an application never re-derives anything.
 */
export function useDayModel(dayMs: number, topN: number) {
  const query = useActivities(dayMs);
  const scheme = useColorScheme();
  const mode: ColorMode = scheme?.mode === "light" ? "light" : "dark";

  const model = useMemo(() => {
    if (!query.data) {
      return null;
    }
    return buildDayModel(query.data.entries, query.data.window, topN, mode, Date.now());
  }, [query.data, topN, mode]);

  return {
    model,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    /** True while showing the previous day's data during a transition. */
    isPlaceholder: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
