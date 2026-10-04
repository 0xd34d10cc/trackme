import { memo, useMemo } from "react";
import { KpiRow, StatTile } from "../../components/StatTile";
import { focusStats } from "../../domain/history";
import { formatDuration, formatPercent } from "../../lib/format";
import type { RangeModel } from "../../lib/hooks/useRangeModel";

/**
 * The range's headline figures, scoped to the current focus.
 *
 * Filtering the chart to one application re-bases every tile on that
 * application — its total, the days it was actually used, and both averages —
 * so the numbers and the chart answer the same question. Idle is not part of
 * an application, so a filtered view has none in play.
 */
export const RangeSummaryTiles = memo(function RangeSummaryTiles({
  model,
  app,
}: {
  model: RangeModel;
  app: string | null;
}) {
  const stats = useMemo(
    () => focusStats(model.dayTotals, model.appTotals, app),
    [model.dayTotals, model.appTotals, app],
  );

  const share =
    app !== null && model.totalActiveMs > 0 ? stats.activeMs / model.totalActiveMs : null;

  return (
    <KpiRow>
      <StatTile
        hero
        label="Active time"
        value={formatDuration(stats.activeMs)}
        sub={share === null ? " " : `${formatPercent(share)} of all activity`}
        hint={
          app === null
            ? "Non-idle recorded time across the range."
            : "This application's recorded time across the range."
        }
      />
      <StatTile
        label="Active days"
        value={`${stats.activeDays} / ${stats.dayCount}`}
        hint="Days in the range with activity for the current selection."
      />
      <StatTile
        label="Average per day"
        value={formatDuration(stats.perDayMs)}
        hint="Total time divided by every day in the range, including days with none."
      />
      <StatTile
        label="Average per active day"
        value={formatDuration(stats.perActiveDayMs)}
        hint="Total time divided by the days that had activity."
      />
    </KpiRow>
  );
});
