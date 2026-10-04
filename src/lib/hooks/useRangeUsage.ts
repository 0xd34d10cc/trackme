import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DailyUsageRow } from "../../domain/types";
import { qk } from "../queryKeys";
import { api } from "../tauri";
import { startOfUtcDay } from "../time";

/**
 * Fetch the per-(day, exe) rollup for a range — one IPC call for however many
 * days it spans, because the aggregation happens in DuckDB.
 *
 * As with `useActivities`, a range that includes today keeps arriving, so it
 * gets a short stale time and a poll; a finished range never changes and is
 * cached forever. `to` stays day-aligned (never `Date.now()`), so the query key
 * does not churn while today is open.
 */
export function useRangeUsage(from: number, to: number) {
  const spansToday = to > startOfUtcDay(Date.now());

  return useQuery({
    queryKey: qk.usageDaily(from, to),
    queryFn: (): Promise<DailyUsageRow[]> => api.usageDaily(from, to),
    enabled: to > from,
    staleTime: spansToday ? 30_000 : Infinity,
    refetchInterval: spansToday ? 60_000 : false,
    placeholderData: keepPreviousData,
  });
}
