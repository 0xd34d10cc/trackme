import { invoke } from "@tauri-apps/api/core";
import type { ActivityEntry, DailyUsageRow } from "../domain/types";
import { MOCK_CONFIG, mockActiveDates, mockSelect, mockUsageDaily } from "./mock";

/** The config JSON shape, mirroring Rust's `Config` (matchers is `flatten`ed). */
export interface Config {
  storage: { location: string | null };
  blacklist: string[];
  matchers: Array<{ name: string; matcher: string }>;
}

/**
 * The only place `invoke` is called. Everything above this module works with
 * plain typed functions, which keeps the command surface in one file and lets
 * the browser build fall back to fixtures.
 */
function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export const api = {
  /** Activity rows overlapping [from, to). */
  async select(from: number, to: number): Promise<ActivityEntry[]> {
    if (!inTauri()) {
      return mockSelect(from, to);
    }
    return invoke<ActivityEntry[]>("select", { from, to });
  },

  /**
   * Per (UTC day, exe) recorded duration over [from, to). Idle is the row with
   * `exe === "idle"`. One round trip serves a whole range, however long.
   */
  async usageDaily(from: number, to: number): Promise<DailyUsageRow[]> {
    if (!inTauri()) {
      return mockUsageDaily(from, to);
    }
    return invoke<DailyUsageRow[]>("usage_daily", { from, to });
  },

  /** UTC-midnight epoch ms for every day that has recorded activity. */
  async activeDates(): Promise<number[]> {
    if (!inTauri()) {
      return mockActiveDates();
    }
    return invoke<number[]>("active_dates");
  },

  async getConfig(): Promise<Config> {
    if (!inTauri()) {
      return MOCK_CONFIG;
    }
    return invoke<Config>("get_config");
  },

  /**
   * Note: the Rust `set_config` only swaps the in-memory config — it does not
   * write `config.json`, so changes do not survive a restart yet.
   */
  async setConfig(next: Config): Promise<void> {
    if (!inTauri()) {
      return;
    }
    await invoke("set_config", { new: next });
  },
};
