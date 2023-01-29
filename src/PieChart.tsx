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

import { ActivityEntry, getFilename, useActivities } from "./utils";
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
  for (const [start, end, pid, exe, _title] of rows) {
    const duration = differenceInSeconds(end, start);
    const current = map.get(exe);
    if (current === undefined) {
      map.set(getFilename(exe), duration);
    } else {
      map.set(getFilename(exe), current + duration);
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
  const [data, error] = useActivities(date);
  if (error != null) {
    console.log(error)
  }

  if (data === null) {
    return <CircularProgress/>
  }

  if (data.length === 0) {
    return <>No data</>
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
