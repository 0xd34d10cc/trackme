import { styled, TextField } from "@mui/material";
import {
  LocalizationProvider,
  PickersDay,
  PickersDayProps,
  DatePicker as BaseDatePicker,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { readDir, BaseDirectory } from "@tauri-apps/api/fs";
import getUnixTime from "date-fns/getUnixTime";
import React from "react";

async function getAvailableDates(): Promise<Set<number>> {
  const dates = new Set<number>();
  const entries = await readDir("trackme", { dir: BaseDirectory.Home });
  for (const entry of entries) {
    if (entry.name === undefined) {
      continue;
    }
    const [date, _] = entry.name.split(".");
    const timepoint = getUnixTime(new Date(date));
    if (Number.isNaN(timepoint)) {
      continue;
    }
    dates.add(timepoint);
  }

  return dates;
}

// TODO: move to effect
const fileEntries = await getAvailableDates();

interface CustomPickerDayProps extends PickersDayProps<Date> {
  dayIsUnavailable: boolean;
}

const CustomPickersDay = styled(PickersDay, {
  shouldForwardProp: (prop) => prop !== "dayIsUnavailable",
})<CustomPickerDayProps>(({ theme, dayIsUnavailable }) => ({
  ...(dayIsUnavailable && {
    color: "#e1e1e1",
  }),
})) as React.ComponentType<CustomPickerDayProps>;

const renderAvailableDays = (
  date: Date,
  selectedDates: Array<Date | null>,
  pickersDayProps: PickersDayProps<Date>
) => {
  const timepoint = getUnixTime(date);
  return (
    <CustomPickersDay
      {...pickersDayProps}
      disableMargin
      dayIsUnavailable={!fileEntries.has(timepoint)}
    />
  );
};

export default function DatePicker({
  date,
  setDate,
}: {
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
}) {
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <BaseDatePicker
        value={date}
        onChange={(date: Date | null, _selectionState?: any) => {
          if (date != null) {
            setDate(date);
          }
        }}
        renderDay={renderAvailableDays}
        renderInput={(params: any) => <TextField {...params} />}
      />
    </LocalizationProvider>
  );
}
