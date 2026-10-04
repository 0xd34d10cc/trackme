import { describe, expect, it } from "vitest";
import { IDLE_LABEL, OTHER_LABEL } from "../appIdentity";
import {
  CHROME,
  PALETTES,
  appColor,
  hashName,
  neutralColor,
  type ColorMode,
} from "../palette";

/**
 * Guards the generated palette.
 *
 * The 32 colours were produced by a generator script rather than chosen by
 * hand, so these assertions are what stop a later hand-edit from quietly
 * dropping a slot below the contrast floor or duplicating one.
 */

const MODES: ColorMode[] = ["dark", "light"];

/** The published size of the palette: the curated 8 plus 11 Tailwind additions. */
const SLOT_COUNT = 19;

/**
 * Three curated colours sit below 3:1 on the light surface. The source palette
 * documents this and pairs it with the "relief rule" — identity must then be
 * carried by visible labels, which the timeline lanes and breakdown rows
 * always are. They still have to be legible, hence the 2:1 floor.
 */
const LIGHT_CONTRAST_EXCEPTIONS = new Set(["#1baf7a", "#eda100", "#e87ba4"]);

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** sRGB hex -> OKLab, for the lightness/chroma guards. */
function toOklab(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

describe("palette", () => {
  it("has a full complement of unique slots in both modes", () => {
    for (const mode of MODES) {
      const { slots } = PALETTES[mode];
      expect(slots).toHaveLength(SLOT_COUNT);
      expect(new Set(slots).size, `${mode} duplicates`).toBe(SLOT_COUNT);
    }
  });

  it("clears 3:1 against the dark surface for every slot", () => {
    const surface = CHROME.dark.surface;
    const failures = PALETTES.dark.slots.filter((slot) => contrast(slot, surface) < 3);
    expect(failures, `below 3:1 on ${surface}`).toEqual([]);
  });

  it("keeps every light slot legible, allowing the three documented exceptions", () => {
    const surface = CHROME.light.surface;
    for (const slot of PALETTES.light.slots) {
      const ratio = contrast(slot, surface);
      if (LIGHT_CONTRAST_EXCEPTIONS.has(slot)) {
        expect(ratio, `${slot} must still be visible`).toBeGreaterThanOrEqual(2);
      } else {
        expect(ratio, `${slot} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(MODES)("keeps every slot in the lightness band in %s mode", (mode) => {
    // The dark column is pinned to the curated eight's own band so no colour
    // looks conspicuously brighter than its neighbours; 8-bit rounding and the
    // light column's wider spread are allowed for.
    const range = mode === "dark" ? [0.50, 0.70] : [0.40, 0.80];
    for (const slot of PALETTES[mode].slots) {
      const { L } = toOklab(slot);
      expect(L, `${slot} lightness`).toBeGreaterThanOrEqual(range[0]!);
      expect(L, `${slot} lightness`).toBeLessThanOrEqual(range[1]!);
    }
  });

  it.each(MODES)("keeps every slot above the chroma floor in %s mode", (mode) => {
    // The light column's cyan region can only reach ~0.08, so the floor is
    // relaxed there rather than pretending otherwise.
    const floor = mode === "dark" ? 0.095 : 0.07;
    for (const slot of PALETTES[mode].slots) {
      const { a, b } = toOklab(slot);
      expect(Math.hypot(a, b), `${slot} chroma`).toBeGreaterThanOrEqual(floor);
    }
  });
});

describe("appColor", () => {
  it("is stable for the same application", () => {
    for (const mode of MODES) {
      expect(appColor("Code.exe", mode)).toBe(appColor("Code.exe", mode));
    }
  });

  it("does not depend on which other applications are present, or their order", () => {
    // This is precisely what the previous rank-based assignment got wrong.
    const first = ["a.exe", "b.exe", "c.exe"].map((app) => appColor(app, "dark"));
    const reversed = ["c.exe", "b.exe", "a.exe"].map((app) => appColor(app, "dark"));
    expect(reversed).toEqual([...first].reverse());
  });

  it("picks the slot the hash selects", () => {
    const { slots } = PALETTES.dark;
    expect(appColor("Code.exe", "dark")).toBe(slots[hashName("Code.exe") % slots.length]);
  });

  it("renders idle and the rolled-up tail as neutral, never as a slot", () => {
    for (const mode of MODES) {
      expect(appColor(IDLE_LABEL, mode)).toBe(neutralColor(mode));
      expect(appColor(OTHER_LABEL, mode)).toBe(neutralColor(mode));
      expect(PALETTES[mode].slots).not.toContain(neutralColor(mode));
    }
  });

  it("spreads a realistic set of applications across many distinct colours", () => {
    const apps = [
      "Code.exe", "firefox.exe", "WindowsTerminal.exe", "slack.exe", "Spotify.exe",
      "Obsidian.exe", "Docker Desktop.exe", "notepad.exe", "Discord.exe", "explorer.exe",
      "chrome.exe", "Teams.exe", "OUTLOOK.EXE", "powershell.exe", "Photoshop.exe",
    ];
    const distinct = new Set(apps.map((app) => appColor(app, "dark"))).size;
    // 15 names into 19 slots averages ~10 distinct; anything near 1 would mean
    // the hash had collapsed.
    expect(distinct).toBeGreaterThanOrEqual(8);
  });
});
