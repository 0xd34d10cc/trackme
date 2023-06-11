import { CircularProgress } from "@mui/material";
import Chart, {
  GoogleDataTableColumn,
  GoogleDataTableColumnRoleType,
} from "react-google-charts";
import {
  ActivityEntry,
  getFilename,
  useActivities,
  DateRange,
  colorOf,
} from "./utils";

const TimelineColumns: GoogleDataTableColumn[] = [
  { type: "string", id: "Executable" },
  { type: "string", id: "Title" },
  { type: "string", role: GoogleDataTableColumnRoleType.style },
  { type: "date", id: "Start" },
  { type: "date", id: "End" },
];

function buildChartData(rows: ActivityEntry[]): any[] {
  const timelineRows = [];
  for (const [start, end, _pid, exeFull, title] of rows) {
    const exe = getFilename(exeFull);
    timelineRows.push([
      exe,
      title,
      colorOf(exe),
      new Date(start),
      new Date(end),
    ]);
  }
  return [TimelineColumns, ...timelineRows];
}

export default function Timeline({ range }: { range: DateRange }) {
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
