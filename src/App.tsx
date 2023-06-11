import { useState } from "react";

import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

import PieChart from "./PieChart";
import Timeline from "./Timeline";
import DatePicker from "./DatePicker";
import { DateRange } from "./utils";
import "./style.css";
import { differenceInDays, subDays } from "date-fns";
import { Grid } from "@mui/material";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

function singleDayLayout(
  range: DateRange,
  setRange: React.Dispatch<React.SetStateAction<DateRange>>
) {
  return (
    <Stack spacing={1} direction={"row"} sx={{ height: "100%", width: "100%" }}>
      <Stack
        spacing={1}
        direction={"column"}
        sx={{ height: "100%", width: "30%" }}
      >
        <Item sx={{ textAlign: "center" }}>
          <DatePicker range={range} setRange={setRange} />
        </Item>

        <Item>
          <PieChart range={range} />
        </Item>
      </Stack>
      <Item sx={{ width: "100%" }}>
        <Timeline range={range} />
      </Item>
    </Stack>
  );
}

const pieChartRanges = [
  {
    days: 3,
    label: "Last 3 days",
  },
  {
    days: 7,
    label: "Last week",
  },
  {
    days: 14,
    label: "Last 2 weeks",
  },
  {
    days: 30,
    label: "Last month",
  },
  {
    days: 60,
    label: "Last 2 months",
  },
  {
    days: 90,
    label: "Last 3 months",
  },
  {
    days: 180,
    label: "Last half of year",
  },
  {
    days: 365,
    label: "Last year",
  },
];

function multipleDaysLayout(
  totalRange: DateRange,
  setRange: React.Dispatch<React.SetStateAction<DateRange>>
) {
  const days = differenceInDays(totalRange.to, totalRange.from);
  const ranges = pieChartRanges
    .filter((range) => range.days <= days)
    .map((r) => {
      return {
        from: subDays(totalRange.to, r.days),
        to: totalRange.to,
        title: r.label,
      };
    });

  const charts = ranges
    .map((range) => <PieChart range={range} title={range.title} />)
    .concat(<PieChart range={totalRange} />)
    .map((chart) => (
      <Grid item>
        <Item>{chart}</Item>{" "}
      </Grid>
    ));

  return (
    <Stack spacing={1} direction={"row"} sx={{ height: "100%", width: "100%" }}>
      <Stack
        spacing={1}
        direction={"column"}
        sx={{ height: "100%", width: "30%" }}
      >
        <Item sx={{ textAlign: "center" }}>
          <DatePicker range={totalRange} setRange={setRange} />
        </Item>
      </Stack>

      <Grid container spacing={1}>
        {charts}
      </Grid>
    </Stack>
  );
}

function App() {
  const [range, setRange] = useState<DateRange>({
    from: new Date(),
    to: new Date(),
  });

  const days = differenceInDays(range.to, range.from);
  if (days === 0) {
    return singleDayLayout(range, setRange);
  }

  return multipleDaysLayout(range, setRange);
}

export default App;
