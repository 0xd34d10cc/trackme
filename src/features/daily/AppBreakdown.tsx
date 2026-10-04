import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { memo, useCallback } from "react";
import { AppSwatch } from "../../components/AppSwatch";
import { Card } from "../../components/Card";
import { percentOfActive } from "../../domain/usage";
import type { AppUsage } from "../../domain/types";
import { formatDuration, formatPercent } from "../../lib/format";
import type { DayModel } from "../../lib/hooks/useDayModel";
import { appColor } from "../../lib/palette";
import { TOP_N_OPTIONS } from "../../app/store";

/**
 * UC-03: where the day's active time went.
 *
 * A sorted horizontal-bar list rather than a pie: comparing close values is
 * what a list of aligned bars is good at and what a pie is worst at. The list
 * doubles as the timeline's legend — swatch, name and duration are always
 * visible, so identity never depends on distinguishing two colours.
 */
export const AppBreakdown = memo(function AppBreakdown({
  model,
  topN,
  selectedApp,
  onSelectApp,
  onTopNChange,
}: {
  model: DayModel;
  topN: number;
  selectedApp: string | null;
  onSelectApp: (app: string | null) => void;
  onTopNChange: (n: number) => void;
}) {
  const { usages, summary } = model;
  const rows = model.selectedUsages;
  const maxMs = rows.length > 0 ? Math.max(...rows.map((row) => row.activeMs)) : 0;

  const handleTopN = useCallback(
    (_event: React.MouseEvent<HTMLElement>, value: number | null) => {
      if (value !== null) {
        onTopNChange(value);
      }
    },
    [onTopNChange],
  );

  return (
    <Card
      title="Applications"
      action={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={topN}
          onChange={handleTopN}
          aria-label="Number of applications shown"
        >
          {TOP_N_OPTIONS.map((option) => (
            <ToggleButton key={option} value={option} sx={{ px: 1, py: 0.25, fontSize: 11 }}>
              Top {option}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
      contentSx={{ p: 0.75 }}
      sx={{ minHeight: 0 }}
    >
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
          No applications recorded.
        </Typography>
      ) : (
        <Stack spacing={0.25}>
          {rows.map((usage) => (
            <AppRow
              key={usage.app}
              usage={usage}
              color={appColor(usage.app, model.mode)}
              maxMs={maxMs}
              activeMs={summary.activeMs}
              selected={selectedApp === usage.app && !usage.isOther}
              onSelectApp={onSelectApp}
            />
          ))}
          {usages.length > rows.length && (
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pt: 0.5 }}>
              {usages.length - (rows.length - 1)} more applications in “Other”.
            </Typography>
          )}
        </Stack>
      )}
    </Card>
  );
});

function AppRow({
  usage,
  color,
  maxMs,
  activeMs,
  selected,
  onSelectApp,
}: {
  usage: AppUsage;
  color: string;
  maxMs: number;
  activeMs: number;
  selected: boolean;
  onSelectApp: (app: string | null) => void;
}) {
  const percent = percentOfActive(usage, activeMs);
  const width = maxMs > 0 ? Math.max(2, (usage.activeMs / maxMs) * 100) : 0;

  const handleClick = useCallback(() => {
    if (usage.isOther) {
      return;
    }
    onSelectApp(selected ? null : usage.app);
  }, [onSelectApp, selected, usage.app, usage.isOther]);

  return (
    <Box
      onClick={handleClick}
      title={`${usage.app} — ${usage.intervalCount} intervals, ${usage.visitCount} visits`}
      sx={{
        display: "grid",
        gridTemplateColumns: "12px 1fr",
        columnGap: 1,
        alignItems: "center",
        px: 1,
        py: 0.5,
        borderRadius: 1,
        cursor: usage.isOther ? "default" : "pointer",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: usage.isOther ? "transparent" : "action.hover" },
      }}
    >
      <AppSwatch color={color} />
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "baseline", justifyContent: "space-between" }}
        >
          <Typography variant="body2" noWrap sx={{ fontWeight: selected ? 600 : 400 }}>
            {usage.app}
          </Typography>
          <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {formatDuration(usage.activeMs)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.25 }}>
          <Box sx={{ flex: 1, height: 5, borderRadius: 1, bgcolor: "action.hover", minWidth: 0 }}>
            <Box sx={{ height: "100%", width: `${width}%`, borderRadius: 1, bgcolor: color }} />
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontVariantNumeric: "tabular-nums", minWidth: 38, textAlign: "right" }}
          >
            {formatPercent(percent)}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
