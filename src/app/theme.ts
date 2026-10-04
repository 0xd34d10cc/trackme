import { createTheme } from "@mui/material/styles";
import { PRIMARY } from "../lib/palette";

/**
 * Dark-first, dense.
 *
 * Surfaces and ink come straight from the chart palette's chrome table so the
 * charts and the app around them share one set of values. Both colour schemes
 * are *selected* rather than one being an automatic flip of the other; MUI
 * persists the chosen mode to localStorage on its own.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "class" },
  colorSchemes: {
    dark: {
      palette: {
        mode: "dark",
        background: { default: "#0d0d0d", paper: "#1a1a19" },
        primary: { main: PRIMARY.dark },
        text: { primary: "#ffffff", secondary: "#c3c2b7" },
        divider: "#2c2c2a",
      },
    },
    light: {
      palette: {
        mode: "light",
        background: { default: "#f9f9f7", paper: "#fcfcfb" },
        primary: { main: PRIMARY.light },
        text: { primary: "#0b0b0b", secondary: "#52514e" },
        divider: "#e1e0d9",
      },
    },
  },
  shape: { borderRadius: 6 },
  typography: {
    // One system sans everywhere, including the hero figures — no display face.
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSize: 13,
    h6: { fontSize: "0.9375rem", fontWeight: 600 },
    body2: { fontSize: "0.8125rem" },
    caption: { fontSize: "0.6875rem" },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
  },
});
