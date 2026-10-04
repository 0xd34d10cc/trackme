import { IDLE_LABEL, OTHER_LABEL } from "./appIdentity";

/**
 * Categorical palette — 19 slots, assigned by hashing the executable name.
 *
 * **Why hashed.** Colour is an *identity* channel here: the same executable
 * must look the same on every date. That rules out assigning by rank (the
 * previous approach), because a rank changes as the day's totals change.
 * Hashing the name is stable by construction; the cost is that two executables
 * can land on the same colour.
 *
 * **Composition.** The first eight are the curated design-system palette
 * (blue, orange, aqua, yellow, magenta, green, violet, red) with its dark and
 * light columns kept exactly as published. The remaining eleven are well-known
 * Tailwind colours — fuchsia, violet, lime, cyan, rose, indigo, pink, green,
 * teal, sky, purple — chosen as follows:
 *
 *   1. Start from the curated eight.
 *   2. Repeatedly add whichever Tailwind colour is *furthest* from everything
 *      already in the set, stopping when nothing is at least ΔE 5 away.
 *
 * That greedy step matters: most of Tailwind's 17 hues duplicate a colour the
 * curated eight already covers (Tailwind yellow-600 `#ca8a04` sits ΔE 1.3 from
 * the curated yellow `#c98500` — visually the same colour). Adding them
 * wholesale produced a palette whose closest pair was ΔE 1.3, worse than
 * anything else tried. Only the eleven above actually add a distinguishable
 * colour.
 *
 * Each Tailwind entry uses the step that lands in the curated eight's own
 * lightness band (0.53–0.67), so nothing looks conspicuously brighter or
 * duller than its neighbours.
 *
 * **Measured.** Dark column: every slot clears 3:1 (3.52–5.67:1), closest pair
 * ΔE 5.1. Light column: the same hues re-stepped; three curated entries sit
 * below 3:1, which the source palette documents — the "relief rule" requires
 * visible labels, and both the timeline lanes and the breakdown rows always
 * name their application.
 *
 * **Known limit.** 19 mutually distinguishable colours do not exist in sRGB,
 * so the closest pair (ΔE 5.1) is below the ΔE 8 target for colour-blind
 * separation. This is accepted deliberately: every application is *named* in
 * the timeline's lane labels and in the breakdown list, so colour is a
 * redundant channel and never the sole carrier of identity. That labelling is
 * load-bearing — do not remove it without shrinking this palette first.
 *
 * `src/lib/__tests__/palette.test.ts` guards uniqueness, contrast, lightness
 * and chroma.
 */

// Curated eight (dark), then the eleven Tailwind additions.
const DARK_SLOTS = [
  "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767",
  "#d946ef", "#8b5cf6", "#65a30d", "#0891b2", "#f43f5e", "#6366f1", "#ec4899", "#16a34a",
  "#0d9488", "#0284c7", "#a855f7",
];

// The same hues re-stepped for the light surface.
const LIGHT_SLOTS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948",
  "#c026d3", "#7c3aed", "#4d7c0f", "#0891b2", "#e11d48", "#4f46e5", "#db2777", "#15803d",
  "#0d9488", "#0284c7", "#9333ea",
];

export type ColorMode = "dark" | "light";

export interface Palette {
  slots: string[];
  /**
   * Neutral for the rolled-up tail and for idle. Idle is a *state*, not an
   * application, so it never takes a categorical slot.
   */
  neutral: string;
}

export const PALETTES: Record<ColorMode, Palette> = {
  dark: { slots: DARK_SLOTS, neutral: "#5c5c58" },
  light: { slots: LIGHT_SLOTS, neutral: "#898781" },
};

/** The app's own accent — deliberately not a slot, so the palette can change freely. */
export const PRIMARY: Record<ColorMode, string> = {
  dark: "#3987e5",
  light: "#2a78d6",
};

/**
 * Chart chrome, per mode.
 *
 * Charts render to canvas, which cannot resolve CSS custom properties — so
 * these are literal hex, read from the mode rather than from the MUI theme.
 * (The theme's palette under `cssVariables` may hold the *default* scheme's
 * literals, which would go stale the moment the user toggles.)
 */
export interface Chrome {
  surface: string;
  ink: string;
  muted: string;
  grid: string;
  axis: string;
}

export const CHROME: Record<ColorMode, Chrome> = {
  dark: {
    surface: "#1a1a19",
    ink: "#ffffff",
    muted: "#898781",
    grid: "#2c2c2a",
    axis: "#383835",
  },
  light: {
    surface: "#fcfcfb",
    ink: "#0b0b0b",
    muted: "#898781",
    grid: "#e1e0d9",
    axis: "#c3c2b7",
  },
};

export function paletteFor(mode: ColorMode): Palette {
  return PALETTES[mode] ?? PALETTES.dark;
}

export function neutralColor(mode: ColorMode): string {
  return paletteFor(mode).neutral;
}

export function chromeFor(mode: ColorMode): Chrome {
  return CHROME[mode] ?? CHROME.dark;
}

/**
 * 32-bit string hash — the multiply-by-31 loop the app has always used, made
 * unsigned so the modulus is well distributed instead of biased by sign.
 */
export function hashName(value: string): number {
  let acc = 0;
  for (let index = 0; index < value.length; index += 1) {
    acc = (acc * 31 + value.charCodeAt(index)) | 0;
  }
  return acc >>> 0;
}

/**
 * The colour for an application.
 *
 * Depends only on the name and the colour scheme — never on the day, the
 * ranking, or which other applications are on screen. `app` is the executable
 * basename (see `appIdentity.ts`), so the colour survives the executable
 * moving on disk.
 */
export function appColor(app: string, mode: ColorMode): string {
  if (app === IDLE_LABEL || app === OTHER_LABEL) {
    return neutralColor(mode);
  }
  const { slots } = paletteFor(mode);
  return slots[hashName(app) % slots.length] ?? neutralColor(mode);
}
