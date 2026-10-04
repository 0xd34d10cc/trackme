import { Chip, Stack } from "@mui/material";
import { useMemo } from "react";
import { useUi } from "../../app/store";
import { ChartContainer } from "../../components/ChartContainer";
import { busiestDay, dailyAppStacks } from "../../domain/history";
import { OTHER_LABEL } from "../../lib/appIdentity";
import { useRangeModel, type RangeModel } from "../../lib/hooks/useRangeModel";
import { HistoryChart } from "./HistoryChart";
import { RangeBody } from "./RangeBody";
import { RangeSummaryTiles } from "./RangeSummaryTiles";

/** How many applications each day breaks out before folding the rest into "Other". */
const STACK_TOP_N = 5;

/**
 * UC-05: how computer usage changes over the selected range.
 *
 * Each day is a stacked bar broken down by the busiest applications, and
 * clicking a segment filters the chart to that one application. The filter is a
 * selection rather than a data window, so the summary tiles stay range-wide;
 * the chip in the card header — and clicking the segment again — clears it.
 * Double-clicking a column opens that day in the daily view.
 */
export function HistoryView() {
  const range = useUi((state) => state.range);
  const filteredApp = useUi((state) => state.overviewApp);
  const setFilteredApp = useUi((state) => state.setOverviewApp);
  const openDay = useUi((state) => state.openDay);

  const state = useRangeModel(range);

  return (
    <RangeBody
      state={state}
      emptyTitle="No activity in this range"
      emptyDescription="Choose another range in the header, or jump to a period with recorded activity."
    >
      {(model) => (
        <HistoryBody
          model={model}
          dimmed={state.isPlaceholder}
          filteredApp={filteredApp}
          onSelectApp={setFilteredApp}
          onOpenDay={openDay}
        />
      )}
    </RangeBody>
  );
}

/**
 * The chart and its summary tiles, sharing one derived stack.
 *
 * A component rather than markup inside the render prop because deriving the
 * stack is a hook. Deriving it once here is also what lets the "Most active
 * day" and "Applications" tiles describe exactly what the chart draws, rather
 * than re-deriving it and risking a second answer.
 */
function HistoryBody({
  model,
  dimmed,
  filteredApp,
  onSelectApp,
  onOpenDay,
}: {
  model: RangeModel;
  dimmed: boolean;
  filteredApp: string | null;
  onSelectApp: (app: string | null) => void;
  onOpenDay: (ms: number) => void;
}) {
  const stacks = useMemo(
    () => dailyAppStacks(model.rows, model.range.from, model.range.to, STACK_TOP_N, filteredApp),
    [model.rows, model.range.from, model.range.to, filteredApp],
  );

  // The chart's segment count, minus the "Other" roll-up — which stands for
  // several applications and so is not one of them.
  const appCount = useMemo(
    () => stacks.series.filter((entry) => entry.app !== OTHER_LABEL).length,
    [stacks],
  );

  // `stacks.totals` is the whole range unfiltered, or the selected
  // application's own series when filtered — so this follows the focus.
  const busiest = useMemo(() => busiestDay(stacks.days, stacks.totals), [stacks]);

  return (
    <Stack spacing={1.5} sx={{ height: "100%", minHeight: 0, p: 1.5 }}>
      <RangeSummaryTiles
        model={model}
        app={filteredApp}
        appCount={appCount}
        busiest={busiest}
      />
      <ChartContainer
        title={filteredApp === null ? "Activity over time" : `Activity over time — ${filteredApp}`}
        height="100%"
        dimmed={dimmed}
        action={
          filteredApp === null ? undefined : (
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              label={filteredApp}
              title="Clear the filter"
              onDelete={() => onSelectApp(null)}
            />
          )
        }
      >
        <HistoryChart
          stacks={stacks}
          mode={model.mode}
          filteredApp={filteredApp}
          onSelectApp={onSelectApp}
          onOpenDay={onOpenDay}
        />
      </ChartContainer>
    </Stack>
  );
}
