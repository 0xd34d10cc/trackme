import {
  Chart,
  GoogleDataTableColumn,
  GoogleDataTableColumnRoleType,
} from "react-google-charts";
import {
  differenceInSeconds,
  intervalToDuration,
  formatDuration,
} from "date-fns";

import { ActivityEntry, useLogFile } from "./utils";
import { CircularProgress } from "@mui/material";

const PieChartColumns: GoogleDataTableColumn[] = [
  { type: "string", id: "Executable" },
  { type: "number", id: "Length" },
  { type: "string", role: GoogleDataTableColumnRoleType.tooltip },
];

function aggregateTime(
  rows: ActivityEntry[]
): IterableIterator<[string, number]> {
  let map: Map<string, number> = new Map();
  for (const [exe, _title, start, end] of rows) {
    const duration = differenceInSeconds(end, start);
    const current = map.get(exe);
    if (current === undefined) {
      map.set(exe, duration);
    } else {
      map.set(exe, current + duration);
    }
  }

  return map.entries();
}

function buildChartData(rows: ActivityEntry[]): any[] {
  const pieRows = [];
  for (const [name, seconds] of aggregateTime(rows)) {
    const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
    const tooltip = name + " - " + formatDuration(duration);
    pieRows.push([name, seconds, tooltip]);
  }
  return [PieChartColumns, ...pieRows];
}

export default function PieChart({ date }: { date: Date }) {
  const [data, error] = useLogFile(date);
  if (error != null) {
    console.log(error)
  }

  if (data === null) {
    return <CircularProgress/>
  }

  return (
    <Chart
      chartType={"PieChart"}
      data={buildChartData(data)}
      options={{
        pieHole: 0.4,
      }}
      width="100%"
      height="600px"
      legendToggle
    />
  )
}
