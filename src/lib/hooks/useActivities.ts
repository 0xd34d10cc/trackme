import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ActivityEntry } from "../../domain/types";
import { qk } from "../queryKeys";
import { api } from "../tauri";
import { dayWindow, startOfUtcDay, type DayWindow } from "../time";

/**
 * The window travels *with* the rows rather than alongside them.
 *
 * That matters because of `keepPreviousData`: while the next day is loading we
 * deliberately keep rendering the previous day's rows. If the window were read
 * from the store instead, those stale rows would be clipped against the *new*
 * day and briefly render as empty.
 */
export interface DayActivities {
  window: DayWindow;
  entries: ActivityEntry[];
}

export function useActivities(dayMs: number) {
  const window = dayWindow(dayMs);
  const isToday = window.from === startOfUtcDay(Date.now());

  return useQuery({
    queryKey: qk.activities(window.from, window.to),
    queryFn: async (): Promise<DayActivities> => ({
      window,
      entries: await api.select(window.from, window.to),
    }),
    // Recorded history never changes, so a past day is fetched once and then
    // read from cache — stepping back onto a visited date costs no IPC at all.
    staleTime: isToday ? 15_000 : Infinity,
    refetchInterval: isToday ? 30_000 : false,
    placeholderData: keepPreviousData,
  });
}
