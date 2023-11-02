import { useState } from "react";

import Stack from "@mui/material/Stack";
import { differenceInDays, subDays } from "date-fns";
import { Grid } from "@mui/material";
import { Insights as InsightsIcon } from "@mui/icons-material";

import { Item } from "../Item";
import PieChart from "./PieChart";
import Timeline from "./Timeline";
import DatePicker from "./DatePicker";
import { DateRange } from "./utils";

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

function singleDayLayout(range: DateRange) {
  return (
    <Item sx={{ width: "100%" }}>
      <Timeline range={range} />
    </Item>
  );
}

function multipleDaysLayout(range: DateRange) {
  const days = differenceInDays(range.to, range.from);
  const ranges = pieChartRanges
    .filter((r) => r.days <= days)
    .map((r) => {
      return {
        from: subDays(range.to, r.days),
        to: range.to,
        title: r.label,
      };
    });

  const charts = ranges
    .map((r) => <PieChart range={r} title={r.title} />)
    .map((chart) => (
      <Grid item>
        <Item>{chart}</Item>
      </Grid>
    ));

  return (
    <Grid container spacing={1}>
      {charts}
    </Grid>
  );
}

function MainArea({ range }: { range: DateRange }) {
  const days = differenceInDays(range.to, range.from);
  if (days === 0) {
    return singleDayLayout(range);
  }

  return multipleDaysLayout(range);
}

function Component() {
  const [range, setRange] = useState<DateRange>({
    from: new Date(),
    to: new Date(),
  });

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

      <MainArea range={range} />
    </Stack>
  );
}

export function View() {
  return {
    name: "Explorer",
    icon: <InsightsIcon />,
    component: Component(),
  };
}
