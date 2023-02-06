import { styled, TextField } from "@mui/material";
import {
  LocalizationProvider,
  PickersDay,
  PickersDayProps,
  DatePicker as BaseDatePicker,
} from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { invoke } from "@tauri-apps/api";
import { getTime } from "date-fns";
import React from "react";

async function getActiveDates(): Promise<Set<number>> {
  const response = await invoke("active_dates") as [number]
  console.log(response)
  const dates = new Set<number>()
  for (const date of response) {
    dates.add(date)
  }
  return Promise.resolve(dates)
}

// TODO: move to effect
const activeDates = await getActiveDates();

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
  _selectedDates: Array<Date | null>,
  pickersDayProps: PickersDayProps<Date>
) => {
  return (
    <CustomPickersDay
      {...pickersDayProps}
      disableMargin
      dayIsUnavailable={!activeDates.has(getTime(date))}
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
