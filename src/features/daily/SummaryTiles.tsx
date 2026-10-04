import { memo } from "react";
import { KpiRow, StatTile } from "../../components/StatTile";
import { formatDuration, formatPercent } from "../../lib/format";
import type { DayModel } from "../../lib/hooks/useDayModel";

const PLACEHOLDER = "—";

/**
 * UC-02: the day's headline numbers.
 *
 * Active time is the single hero — the one figure the whole view is about. The
 * rest are compact. Definitions that are easy to misread (untracked is not
 * idle) carry a hint tooltip.
 */
export const SummaryTiles = memo(function SummaryTiles({
  model,
}: {
  model: DayModel | null;
}) {
  if (!model) {
    return (
      <KpiRow>
        <StatTile label="Active time" value={PLACEHOLDER} hero />
        <StatTile label="Idle time" value={PLACEHOLDER} />
        <StatTile label="Tracked" value={PLACEHOLDER} />
        <StatTile label="Untracked" value={PLACEHOLDER} />
        <StatTile label="App switches" value={PLACEHOLDER} />
        <StatTile label="Intervals" value={PLACEHOLDER} />
      </KpiRow>
    );
  }

  const { summary } = model;

  return (
    <KpiRow>
      <StatTile
        hero
        label="Active time"
        value={formatDuration(summary.activeMs)}
        sub={`${formatPercent(summary.activeMs / summary.windowMs)} of the day`}
        hint="Time with a non-idle application in the foreground."
      />
      <StatTile
        label="Idle time"
        value={formatDuration(summary.idleMs)}
        sub={`${summary.idleIntervalCount} idle periods`}
        hint="Away from keyboard for more than 5 minutes."
      />
      <StatTile
        label="Tracked"
        value={formatDuration(summary.trackedMs)}
        sub={`${formatPercent(summary.coverage)} coverage`}
        hint="Active plus idle — everything the tracker recorded."
      />
      <StatTile
        label="Untracked"
        value={formatDuration(summary.untrackedMs)}
        sub="not recorded at all"
        hint="Time with no recorded data. This is not idle — it means the tracker was not running or the activity was filtered out."
      />
      <StatTile
        label="App switches"
        value={summary.appSwitchCount.toLocaleString()}
        sub={`${summary.visitCount} visits`}
        hint="Foreground application changes. Going idle and returning to the same app is not a switch, and neither is a change across a gap in tracking."
      />
      <StatTile
        label="Intervals"
        value={summary.intervalCount.toLocaleString()}
        sub={`${summary.distinctAppCount} applications`}
        hint="Recorded activity blocks, excluding idle."
      />
    </KpiRow>
  );
});
