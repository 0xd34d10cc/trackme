import { useQuery } from "@tanstack/react-query";
import { qk } from "../queryKeys";
import { api } from "../tauri";

/**
 * UTC-midnight epoch ms for every day that holds activity. Whole-database and
 * cheap, so it is cached for a few minutes and shared by the date picker (and
 * later by the calendar view).
 */
export function useActiveDates() {
  return useQuery({
    queryKey: qk.activeDates(),
    queryFn: () => api.activeDates(),
    staleTime: 5 * 60_000,
  });
}
