import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * A card with a fixed-height plot area.
 *
 * The height is fixed on purpose: an auto-sized chart inside a `ResizeObserver`
 * is a feedback loop waiting to happen, and a stable height also means
 * navigating between days never shifts the layout.
 */
export function ChartContainer({
  title,
  action,
  height,
  dimmed = false,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  height: number | string;
  /** Held at reduced opacity while the next date loads — no skeleton flash. */
  dimmed?: boolean;
  children: ReactNode;
}) {
  return (
    <Card title={title} action={action} sx={{ height }} contentSx={{ p: 0.5 }}>
      <Box
        sx={{
          height: "100%",
          opacity: dimmed ? 0.45 : 1,
          transition: "opacity 120ms linear",
          pointerEvents: dimmed ? "none" : "auto",
        }}
      >
        {children}
      </Box>
    </Card>
  );
}
