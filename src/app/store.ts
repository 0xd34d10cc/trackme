import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampRange,
  DAY_MS,
  presetRange,
  startOfUtcDay,
  type DayWindow,
  type RangePreset,
} from "../lib/time";

/** The navigable views. Exported so the rehydrate guard can validate a stored id. */
export const VIEW_IDS = ["daily", "history", "settings"] as const;
export type ViewId = (typeof VIEW_IDS)[number];

/** The palette has many slots; the breakdown lists this many before "Other". */
export const TOP_N_OPTIONS = [5, 8] as const;
export const DEFAULT_TOP_N = 8;

export type RangePresetValue = RangePreset | "custom";

interface UiState {
  activeView: ViewId;
  /** Epoch ms of the selected UTC midnight. */
  date: number;
  /** Whether the timeline draws the idle lane. */
  showIdle: boolean;
  /** How many applications the breakdown lists before "Other". */
  topN: number;
  /** Application selected in the breakdown, emphasised on the timeline. */
  selectedApp: string | null;

  /** The historical range: half-open [from, to), UTC-day aligned. */
  range: DayWindow;
  rangePreset: RangePresetValue;
  /**
   * Application the History chart is filtered to. Null means the stacked view.
   * A selection rather than configuration, so it is not persisted.
   */
  overviewApp: string | null;

  setActiveView: (view: ViewId) => void;
  setDate: (ms: number) => void;
  stepDate: (days: number) => void;
  goToday: () => void;
  setShowIdle: (show: boolean) => void;
  setTopN: (n: number) => void;
  setSelectedApp: (app: string | null) => void;
  /** Jump to the daily view on the given day — the "open this day" action. */
  openDay: (ms: number) => void;

  setRange: (range: DayWindow, preset?: RangePresetValue) => void;
  setRangePreset: (preset: RangePreset) => void;
  stepRange: (direction: -1 | 1) => void;

  setOverviewApp: (app: string | null) => void;
}

/**
 * UI state, deliberately separate from the server cache in react-query.
 *
 * This is what makes UC-04's "preserve configuration when changing dates" fall
 * out for free: `setDate` touches the date and nothing else, so `showIdle`,
 * `topN` and the active view survive navigation without any bookkeeping. The
 * historical range and its controls follow the same rule.
 */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      activeView: "daily",
      date: startOfUtcDay(Date.now()),
      showIdle: true,
      topN: DEFAULT_TOP_N,
      selectedApp: null,

      range: presetRange("30d"),
      rangePreset: "30d",
      overviewApp: null,

      setActiveView: (activeView) => set({ activeView }),

      // `selectedApp` is a selection, not configuration: the app may not exist
      // on the day we're moving to, so it is cleared rather than carried over.
      setDate: (ms) => set({ date: startOfUtcDay(ms), selectedApp: null }),
      stepDate: (days) =>
        set((state) => ({ date: state.date + days * DAY_MS, selectedApp: null })),
      goToday: () => set({ date: startOfUtcDay(Date.now()), selectedApp: null }),

      setShowIdle: (showIdle) => set({ showIdle }),
      setTopN: (topN) => set({ topN }),
      setSelectedApp: (selectedApp) => set({ selectedApp }),

      // Same reasoning as `setDate`: the selection belongs to the day we were
      // looking at, so it is dropped rather than carried across.
      openDay: (ms) =>
        set({ date: startOfUtcDay(ms), selectedApp: null, activeView: "daily" }),

      // Clamp at the edge so a range can never run into the future or past the
      // query cap; an entirely-future range is ignored rather than applied.
      setRange: (range, preset = "custom") =>
        set(() => {
          const clamped = clampRange(range);
          return clamped ? { range: clamped, rangePreset: preset } : {};
        }),
      setRangePreset: (preset) => set({ range: presetRange(preset), rangePreset: preset }),
      // Stepping shifts the window by its own span, so the preset no longer
      // describes what is on screen — it becomes a custom range.
      stepRange: (direction) =>
        set((state) => {
          const span = state.range.to - state.range.from;
          const clamped = clampRange({
            from: state.range.from + direction * span,
            to: state.range.to + direction * span,
          });
          return clamped ? { range: clamped, rangePreset: "custom" } : {};
        }),

      setOverviewApp: (overviewApp) => set({ overviewApp }),
    }),
    {
      name: "trackme-ui",
      // Persisted to localStorage, which survives restarts in the Tauri
      // webview — no plugin and no backend round-trip needed.
      partialize: (state) => ({
        activeView: state.activeView,
        date: state.date,
        showIdle: state.showIdle,
        topN: state.topN,
        range: state.range,
        rangePreset: state.rangePreset,
      }),
      // A relative preset ("30d") must mean the last 30 days from *today*, not
      // from whenever the app last closed; a custom range is restored as-is.
      // A view id that no longer exists (a removed view) falls back to the
      // first route, so an old persisted value cannot strand the shell.
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return;
        }
        if (!(VIEW_IDS as readonly string[]).includes(state.activeView)) {
          state.setActiveView(VIEW_IDS[0]);
        }
        const restored =
          state.rangePreset === "custom" ? state.range : presetRange(state.rangePreset);
        state.setRange(clampRange(restored) ?? presetRange("30d"), state.rangePreset);
      },
    },
  ),
);
