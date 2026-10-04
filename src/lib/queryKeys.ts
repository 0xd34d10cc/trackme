/** Central query-key factory so cache entries can be found and invalidated reliably. */
export const qk = {
  /** Keyed by the day window, not the raw entries — one entry per day. */
  activities: (from: number, to: number) => ["activities", from, to] as const,
  activeDates: () => ["activeDates"] as const,
  config: () => ["config"] as const,
};
