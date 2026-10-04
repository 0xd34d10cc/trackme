import { useColorScheme } from "@mui/material/styles";
import { useMemo } from "react";
import {
  perAppTotals,
  perDayTotals,
  type AppTotal,
  type DayTotal,
} from "../../domain/history";
import type { DailyUsageRow } from "../../domain/types";
import type { ColorMode } from "../palette";
import type { DayWindow } from "../time";
import { useRangeUsage } from "./useRangeUsage";

/**
 * Everything the historical views need, derived **once** — the same contract as
 * `DayModel`. The tiles, the activity chart, the application list, the weekday
 * chart and the calendar heatmap all read this one object.
 *
 * The per-day application breakdown is deliberately *not* here: the History
 * chart derives its stacked series from `rows` itself, so changing which
 * application is filtered never re-derives the base aggregates. `rows` is kept
 * because it is compact (one row per day×app) and is what that derivation
 * reads.
 */
export interface RangeModel {
  range: DayWindow;
  mode: ColorMode;
  rows: DailyUsageRow[];
  /** One entry per UTC day in the range, gap-filled with zeros. */
  dayTotals: DayTotal[];
  /** Every application, sorted by active time descending. Idle excluded. */
  appTotals: AppTotal[];
  /** Total non-idle time across the range, every application. */
  totalActiveMs: number;
  /** True once any row exists in the range (even an all-idle day). */
  hasData: boolean;
}

function buildRangeModel(
  rows: DailyUsageRow[],
  range: DayWindow,
  mode: ColorMode,
): RangeModel {
  const dayTotals = perDayTotals(rows, range.from, range.to);
  const appTotals = perAppTotals(rows);

  let totalActiveMs = 0;
  let hasData = false;
  for (const day of dayTotals) {
    totalActiveMs += day.activeMs;
    if (day.intervalCount > 0) {
      hasData = true;
    }
  }

  return { range, mode, rows, dayTotals, appTotals, totalActiveMs, hasData };
}

/** Fetch and derive a range. Memoised on the query data — stable while cached. */
export function useRangeModel(range: DayWindow) {
  const query = useRangeUsage(range.from, range.to);
  const scheme = useColorScheme();
  const mode: ColorMode = scheme?.mode === "light" ? "light" : "dark";

  const { from, to } = range;
  const model = useMemo(() => {
    if (!query.data) {
      return null;
    }
    return buildRangeModel(query.data, { from, to }, mode);
  }, [query.data, from, to, mode]);

  return {
    model,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    /** True while showing the previous range's data during a transition. */
    isPlaceholder: query.isPlaceholderData,
    error: query.error,
    refetch: query.refetch,
  };
}
