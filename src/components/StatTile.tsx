import { Paper, Typography } from "@mui/material";
import { memo } from "react";

interface StatTileProps {
  label: string;
  value: string;
  /** Secondary line — a share, a count, a clarifying note. */
  sub?: string;
  /** Exactly one tile per view should be the hero. */
  hero?: boolean;
  /** Tooltip explaining a number whose definition is not obvious. */
  hint?: string;
}

/**
 * A single figure. Not every question needs a chart, and most of this
 * dashboard's questions are answered by a number — so the number gets a tile
 * rather than being buried in a plot.
 *
 * Memoised: values are strings, so a parent re-render that doesn't change them
 * costs nothing.
 */
export const StatTile = memo(function StatTile({
  label,
  value,
  sub,
  hero = false,
  hint,
}: StatTileProps) {
  return (
    <Paper
      variant="outlined"
      title={hint}
      sx={{ px: 1.5, py: 1, minWidth: 0, minHeight: 78, display: "flex", flexDirection: "column" }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>
        {label}
      </Typography>
      {/* Proportional figures: these are standalone numbers, not a column. */}
      <Typography
        sx={{
          fontSize: hero ? 30 : 22,
          fontWeight: 600,
          lineHeight: 1.15,
          mt: 0.25,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: "auto" }}>
        {sub ?? " "}
      </Typography>
    </Paper>
  );
});

export function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}
