import { memo, useMemo } from "react";
import { KpiRow, StatTile } from "../../components/StatTile";
import { focusStats, type BusiestDay } from "../../domain/history";
import { formatDayMedium, formatDuration, formatPercent } from "../../lib/format";
import type { RangeModel } from "../../lib/hooks/useRangeModel";

/**
 * The range's headline figures, scoped to the current focus.
 *
 * Filtering the chart to one application re-bases every tile on that
 * application — its total, the days it was actually used, the average over
 * those days, and its busiest day — so the numbers and the chart answer the
 * same question. Idle is not part of an application, so a filtered view has
 * none in play.
 *
 * The percentage each tile carries is the comparison that means something in
 * its state: unfiltered, how much of the period was spent active; filtered,
 * how much of the total this application accounts for.
 */
export const RangeSummaryTiles = memo(function RangeSummaryTiles({
  model,
  app,
  appCount,
  busiest,
}: {
  model: RangeModel;
  app: string | null;
  /** Distinct applications drawn as segments — excludes the "Other" roll-up. */
  appCount: number;
  /** The focus's busiest day, or null when nothing was recorded. */
  busiest: BusiestDay | null;
}) {
  const stats = useMemo(
    () => focusStats(model.dayTotals, model.appTotals, app),
    [model.dayTotals, model.appTotals, app],
  );

  // The range's elapsed wall-clock time. Capped at "now" so an unfinished today
  // does not inflate the denominator — the same reason the daily view caps its
  // totals window.
  const elapsedMs = Math.max(1, Math.min(model.range.to, Date.now()) - model.range.from);
  const timeShare =
    app === null
      ? stats.activeMs / elapsedMs
      : model.totalActiveMs > 0
        ? stats.activeMs / model.totalActiveMs
        : 0;
  const dayShare = stats.dayCount > 0 ? stats.activeDays / stats.dayCount : 0;

  return (
    <KpiRow>
      <StatTile
        hero
        label="Active time"
        value={formatDuration(stats.activeMs)}
        sub={`${formatPercent(timeShare)} ${app === null ? "of the range" : "of all activity"}`}
        hint={
          app === null
            ? "Non-idle recorded time across the range."
            : "This application's recorded time across the range."
        }
      />
      <StatTile
        label="Active days"
        value={`${stats.activeDays} / ${stats.dayCount}`}
        sub={`${formatPercent(dayShare)} of days`}
        hint="Days in the range with activity for the current selection."
      />
      <StatTile
        label="Average per day"
        value={formatDuration(stats.perActiveDayMs)}
        hint="Total time divided by the days that had activity."
      />
      <StatTile
        label="Most active day"
        value={busiest ? formatDuration(busiest.activeMs) : "—"}
        sub={busiest ? formatDayMedium(busiest.dayMs) : " "}
        hint={
          app === null
            ? "The day with the most active time in the range."
            : "The day with the most time in this application."
        }
      />
      {app === null && (
        <StatTile
          label="Applications"
          value={String(appCount)}
          hint="Distinct applications drawn in the chart across the range."
        />
      )}
    </KpiRow>
  );
});
