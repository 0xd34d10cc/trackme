import type { SxProps, Theme } from "@mui/material/styles";

/**
 * Styling shared by the react-day-picker popovers.
 *
 * Driven from MUI's CSS variables rather than JS palette literals: a literal
 * would be the *default* colour scheme's value and would go stale when the
 * scheme is toggled. The `--rdp-range_*` variables are simply unused by the
 * single-day picker, so one object serves every mode.
 */
export const pickerPaperSx: SxProps<Theme> = {
  p: 1,
  bgcolor: "background.paper",
  "& .rdp-root": {
    "--rdp-accent-color": "var(--mui-palette-primary-main)",
    "--rdp-accent-background-color": "rgb(var(--mui-palette-primary-mainChannel) / 0.25)",
    "--rdp-range_start-background": "var(--mui-palette-primary-main)",
    "--rdp-range_end-background": "var(--mui-palette-primary-main)",
    "--rdp-range_middle-background-color": "rgb(var(--mui-palette-primary-mainChannel) / 0.18)",
    "--rdp-today-color": "var(--mui-palette-primary-main)",
    color: "var(--mui-palette-text-primary)",
  },
  "& .rdp-day_button": { position: "relative" },
  "& .rdp-day": { color: "inherit" },
  "& .rdp-disabled": { opacity: 0.3 },
  "& .rdp-selected .rdp-day_button": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
  },
  // `modifiersClassNames` values are applied verbatim — react-day-picker does
  // not prefix them — so this selector must match the name passed to it.
  "& .rdp-hasActivity .rdp-day_button::after": {
    content: '""',
    position: "absolute",
    bottom: 3,
    left: "50%",
    transform: "translateX(-50%)",
    width: 4,
    height: 4,
    borderRadius: "50%",
    bgcolor: "primary.main",
  },
};
