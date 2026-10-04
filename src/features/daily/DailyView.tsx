import { Box, Button, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import { useCallback } from "react";
import { useUi } from "../../app/store";
import { ChartContainer } from "../../components/ChartContainer";
import { EmptyState, ErrorState, LoadingState } from "../../components/states";
import { useDayModel } from "../../lib/hooks/useDayModel";
import { AppBreakdown } from "./AppBreakdown";
import { SummaryTiles } from "./SummaryTiles";
import { TimelineChart } from "./TimelineChart";

/**
 * UC-01…UC-03: the daily dashboard.
 *
 * A KPI strip on top, then the timeline (wide) beside the application
 * breakdown. One `useDayModel` call feeds all three panels.
 */
export function DailyView() {
  const date = useUi((state) => state.date);
  const topN = useUi((state) => state.topN);
  const showIdle = useUi((state) => state.showIdle);
  const selectedApp = useUi((state) => state.selectedApp);
  const setSelectedApp = useUi((state) => state.setSelectedApp);
  const setTopN = useUi((state) => state.setTopN);
  const setShowIdle = useUi((state) => state.setShowIdle);
  const goToday = useUi((state) => state.goToday);

  const { model, isLoading, isPlaceholder, error, refetch } = useDayModel(date, topN);

  const handleIdleToggle = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      setShowIdle(checked);
    },
    [setShowIdle],
  );

  const isEmpty = model !== null && model.intervals.length === 0;

  let timeline: React.ReactNode;
  if (error) {
    timeline = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (isLoading && !model) {
    timeline = <LoadingState />;
  } else if (isEmpty) {
    timeline = (
      <EmptyState
        title="No activity recorded on this date"
        description="The tracker may not have been running."
        action={
          model?.isToday ? undefined : (
            <Button size="small" variant="outlined" onClick={goToday}>
              Jump to today
            </Button>
          )
        }
      />
    );
  } else if (model) {
    timeline = (
      <TimelineChart
        model={model}
        showIdle={showIdle}
        selectedApp={selectedApp}
        onSelectApp={setSelectedApp}
      />
    );
  } else {
    timeline = <LoadingState />;
  }

  return (
    <Stack
      sx={{
        p: 1.5,
        height: "100%",
        minHeight: 0,
        gap: 1,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SummaryTiles model={model} />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gap: 1,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" },
          gridTemplateRows: { xs: "minmax(320px, 1fr) auto", lg: "minmax(0, 1fr)" },
        }}
      >
        <ChartContainer
          height="100%"
          dimmed={isPlaceholder}
          title="Activity timeline"
          action={
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Switch size="small" checked={showIdle} onChange={handleIdleToggle} />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Idle
                </Typography>
              }
            />
          }
        >
          {timeline}
        </ChartContainer>

        <Box sx={{ minHeight: 0, overflowY: "auto" }}>
          {model ? (
            <AppBreakdown
              model={model}
              topN={topN}
              selectedApp={selectedApp}
              onSelectApp={setSelectedApp}
              onTopNChange={setTopN}
            />
          ) : (
            <ChartContainer height="100%" title="Applications">
              <LoadingState label="" />
            </ChartContainer>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
