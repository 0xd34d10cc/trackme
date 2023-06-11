import {
  Chart,
  GoogleDataTableColumn,
  GoogleDataTableColumnRoleType,
} from "react-google-charts";
import { intervalToDuration } from "date-fns";

import {
  getFilename,
  useDurationByExe,
  DateRange,
  formatDurationShort,
  colorOf,
} from "./utils";
import { CircularProgress } from "@mui/material";

const PieChartColumns: GoogleDataTableColumn[] = [
  { type: "string", label: "Executable" },
  { type: "number", label: "Length" },
  {
    type: "string",
    role: GoogleDataTableColumnRoleType.tooltip,
  },
];

function aggregateTime(
  rows: [string, number][]
): IterableIterator<[string, number]> {
  let map: Map<string, number> = new Map();
  for (const [exe, duration] of rows) {
    const key = getFilename(exe);
    const current = map.get(key);
    if (current === undefined) {
      map.set(key, duration);
    } else {
      map.set(key, current + duration);
    }
  }

  return map.entries();
}

function buildChartData(rows: [string, number][]): {
  rows: any[];
  total: Duration;
} {
  const pieRows: [string, number, string][] = [];
  let total = 0;
  for (const [name, ms] of aggregateTime(rows)) {
    total += ms;
    const duration = intervalToDuration({ start: 0, end: ms });
    const tooltip = name + " - " + formatDurationShort(duration);
    pieRows.push([name, ms / 1000, tooltip]);
  }

  pieRows.sort((a, b) => b[1] - a[1]);
  return {
    rows: pieRows,
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
  const [data, error] = useDurationByExe(range);
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
      data={[PieChartColumns, ...rows]}
      height="100%"
      options={{
        title: title
          ? `${title} (${formatDurationShort(total)})`
          : `Total ${formatDurationShort(total)}`,
        pieHole: 0.4,
        colors: rows.map((row) => colorOf(row[0])),
      }}
      legendToggle
    />
  );
}
