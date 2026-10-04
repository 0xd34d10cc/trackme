import { chromeFor, type ColorMode } from "../../lib/palette";

/** Shared chart chrome so the range views match the daily timeline's look. */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tooltip styling shared by every range chart. */
export function tooltipStyle(mode: ColorMode) {
  const chrome = chromeFor(mode);
  return {
    backgroundColor: chrome.surface,
    borderColor: chrome.grid,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: chrome.ink, fontSize: 12 },
    extraCssText: "border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,0.35)",
  };
}
