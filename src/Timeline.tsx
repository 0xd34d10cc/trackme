import { CircularProgress } from "@mui/material";
import Chart, { GoogleDataTableColumn } from "react-google-charts";
import { ActivityEntry, getFilename, useActivities } from "./utils";
import { DateRange } from "react-day-picker";

const TimelineColumns: GoogleDataTableColumn[] = [
  { type: "string", id: "Executable" },
  { type: "string", id: "Title" },
  { type: "date", id: "Start" },
  { type: "date", id: "End" },
];

function buildChartData(rows: ActivityEntry[]): any[] {
  const timelineRows = [];
  for (const [start, end, _pid, exe, title] of rows) {
    timelineRows.push([getFilename(exe), title, start, end]);
  }
  return [TimelineColumns, ...timelineRows];
}

export default function Timeline({ range }: { range: DateRange | undefined }) {
  if (!range) {
    console.warn('Date range is undefined');
    return <></>
  }

  const [data, error] = useActivities(range);
  if (error != null) {
    console.log(error);
  }

  if (data === null) {
    return <CircularProgress />;
  }

  if (data.length == 0) {
    return <>No data</>;
  }

  return (
    <div className="timeline">
      <Chart
        chartType={"Timeline"}
        data={buildChartData(data)}
        options={{
          timeline: { colorByRowLabel: true },
        }}
        height="100%"
        legendToggle
      />
    </div>
  );
}
