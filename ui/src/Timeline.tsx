import { CircularProgress } from "@mui/material";
import Chart, { GoogleDataTableColumn } from "react-google-charts";
import { ActivityEntry, useLogFile } from "./utils";

const TimelineColumns: GoogleDataTableColumn[] = [
  { type: "string", id: "Executable" },
  { type: "string", id: "Title" },
  { type: "date", id: "Start" },
  { type: "date", id: "End" },
];

function buildChartData(rows: ActivityEntry[]): any[] {
  return [TimelineColumns, ...rows];
}

export default function Timeline({ date }: { date: Date }) {
  const [data, error] = useLogFile(date)
  if (error != null) {
    console.log(error)
  }

  if (data == null) {
    return <CircularProgress/>
  }

  return (
    <Chart
      chartType={"Timeline"}
      data={buildChartData(data)}
      options={{
        timeline: { colorByRowLabel: true },
      }}
      width="100%"
      height="600px"
      legendToggle
    />
  )

}
