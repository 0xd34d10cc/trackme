import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DAY_MS, startOfUtcDay } from "../lib/time";

export type ViewId = "daily" | "settings";

/** The palette has eight slots; a ninth application folds into "Other". */
export const TOP_N_OPTIONS = [5, 8] as const;
export const DEFAULT_TOP_N = 8;

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

  setActiveView: (view: ViewId) => void;
  setDate: (ms: number) => void;
  stepDate: (days: number) => void;
  goToday: () => void;
  setShowIdle: (show: boolean) => void;
  setTopN: (n: number) => void;
  setSelectedApp: (app: string | null) => void;
}

/**
 * UI state, deliberately separate from the server cache in react-query.
 *
 * This is what makes UC-04's "preserve configuration when changing dates" fall
 * out for free: `setDate` touches the date and nothing else, so `showIdle`,
 * `topN` and the active view survive navigation without any bookkeeping.
 */
export const useUi = create<UiState>()(
  persist(
    (set) => ({
      activeView: "daily",
      date: startOfUtcDay(Date.now()),
      showIdle: true,
      topN: DEFAULT_TOP_N,
      selectedApp: null,

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
      }),
    },
  ),
);
