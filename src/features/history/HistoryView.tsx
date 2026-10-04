import { Chip, FormControl, MenuItem, Select, Stack, Switch, Typography } from "@mui/material";
import { ROLLING_WINDOW_OPTIONS, useUi } from "../../app/store";
import { ChartContainer } from "../../components/ChartContainer";
import { useRangeModel } from "../../lib/hooks/useRangeModel";
import { HistoryChart } from "./HistoryChart";
import { RangeBody } from "./RangeBody";
import { RangeSummaryTiles } from "./RangeSummaryTiles";

/**
 * UC-05: how computer usage changes over the selected range.
 *
 * Each day is a stacked bar broken down by the busiest applications, and
 * clicking a segment filters the chart to that one application. The filter is
 * a selection rather than a data window, so the summary tiles stay range-wide;
 * the chip in the card header — and clicking the segment again — clears it.
 */
export function HistoryView() {
  const range = useUi((state) => state.range);
  const rolling = useUi((state) => state.rollingAverage);
  const windowDays = useUi((state) => state.rollingWindowDays);
  const filteredApp = useUi((state) => state.overviewApp);
  const setRolling = useUi((state) => state.setRollingAverage);
  const setWindowDays = useUi((state) => state.setRollingWindowDays);
  const setFilteredApp = useUi((state) => state.setOverviewApp);

  const state = useRangeModel(range);

  return (
    <RangeBody
      state={state}
      emptyTitle="No activity in this range"
      emptyDescription="Choose another range in the header, or jump to a period with recorded activity."
    >
      {(model) => (
        <Stack spacing={1.5} sx={{ height: "100%", minHeight: 0, p: 1.5 }}>
          <RangeSummaryTiles model={model} app={filteredApp} />
          <ChartContainer
            title={filteredApp === null ? "Activity over time" : `Activity over time — ${filteredApp}`}
            height="100%"
            dimmed={state.isPlaceholder}
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {filteredApp !== null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="primary"
                    label={filteredApp}
                    title="Clear the filter"
                    onDelete={() => setFilteredApp(null)}
                  />
                )}
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <Switch
                    size="small"
                    checked={rolling}
                    onChange={(event) => setRolling(event.target.checked)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Average
                  </Typography>
                </Stack>
                <FormControl size="small" variant="outlined" sx={{ minWidth: 72 }}>
                  <Select
                    value={windowDays}
                    disabled={!rolling}
                    onChange={(event) => setWindowDays(Number(event.target.value))}
                    sx={{ fontSize: 12 }}
                  >
                    {ROLLING_WINDOW_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option} sx={{ fontSize: 12 }}>
                        {option}d
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            }
          >
            <HistoryChart
              rows={model.rows}
              from={model.range.from}
              to={model.range.to}
              mode={model.mode}
              filteredApp={filteredApp}
              rolling={rolling}
              windowDays={windowDays}
              onSelectApp={setFilteredApp}
            />
          </ChartContainer>
        </Stack>
      )}
    </RangeBody>
  );
}
