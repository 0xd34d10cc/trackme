import { useState } from "react";

import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import { styled } from "@mui/material/styles";

import PieChart from "./PieChart";
import Timeline from "./Timeline";
import DatePicker from "./DatePicker";
import "./style.css";
import { DateRange } from "react-day-picker";

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "#1A2027" : "#fff",
  ...theme.typography.body2,
  padding: theme.spacing(1),
  color: theme.palette.text.secondary,
}));

function App() {
  // TODO: use custom DateRange type to avoid undefined}
  const [range, setRange] = useState<DateRange | undefined>({from: new Date(), to: new Date()});
  return (
    <Stack spacing={1} direction={"row"} sx={{ height: "100%", width: "100%" }}>
      <Stack spacing={1} direction={"column"} sx={{ height: "100%", width: "30%" }}>
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

export default App;
