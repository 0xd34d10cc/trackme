import {
  Chart,
  GoogleDataTableColumn,
  GoogleDataTableColumnRoleType,
} from "react-google-charts";
import { intervalToDuration, formatDuration } from "date-fns";

import {
  ActivityEntry,
  getFilename,
  useActivities,
  DateRange,
  formatDurationShort,
} from "./utils";
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
  for (const [start, end, _pid, exe, _title] of rows) {
    const key = getFilename(exe);
    const duration = end - start;
    const current = map.get(key);
    if (current === undefined) {
      map.set(key, duration);
    } else {
      map.set(key, current + duration);
    }
  }

  return map.entries();
}

function buildChartData(rows: ActivityEntry[]): {
  rows: any[];
  total: Duration;
} {
  const pieRows = [];
  let total = 0;
  for (const [name, ms] of aggregateTime(rows)) {
    total += ms;
    const duration = intervalToDuration({ start: 0, end: ms });
    const tooltip = name + " - " + formatDurationShort(duration);
    pieRows.push([name, ms / 1000, tooltip]);
  }

  const data = [PieChartColumns, ...pieRows];
  return {
    rows: data,
    total: intervalToDuration({ start: 0, end: total }),
  };
}

export default function PieChart({
  range,
  title,
}: {
  range: DateRange;
  title?: string;
}) {
  const [data, error] = useActivities(range);
  if (error != null) {
    console.log(error);
  }

  if (data === null) {
    return <CircularProgress />;
  }

  if (data.length === 0) {
    return <>No data</>;
  }

  const { rows, total } = buildChartData(data);
  return (
    <Chart
      chartType={"PieChart"}
      data={rows}
      height="100%"
      options={{
        title: title
          ? `${title} (${formatDurationShort(total)})`
          : `Total ${formatDurationShort(total)}`,
        pieHole: 0.4,
      }}
      legendToggle
    />
  );
}
