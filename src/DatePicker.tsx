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
import React, { useEffect, useState } from "react";

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


function today(): number {
  const millisecondsInDay = 24 * 60 * 60 * 1000
  const date = new Date().getTime()
  return date - (date % millisecondsInDay)
}

async function getActiveDates(): Promise<Set<number>> {
  const response = await invoke("active_dates") as [number]
  const dates = new Set<number>()
  for (const date of response) {
    dates.add(date)
  }

  console.log(`${dates.size} days active`)
  return Promise.resolve(dates)
}

export default function DatePicker({
  date,
  setDate,
}: {
  date: Date;
  setDate: React.Dispatch<React.SetStateAction<Date>>;
}) {
  const [activeDays, setActiveDays] = useState(null as null | Set<number>)

  useEffect(() => {
    const loadActiveDays = async () => {
      const dates = await getActiveDates()
      setActiveDays(dates)
    }

    loadActiveDays()
  }, [today()])

  const renderAvailableDays = (
    date: Date,
    _selectedDates: Array<Date | null>,
    pickersDayProps: PickersDayProps<Date>
  ) => {
    const isAvailable = activeDays === null || activeDays.has(getTime(date));
    return (
      <CustomPickersDay
        {...pickersDayProps}
        disableMargin
        dayIsUnavailable={!isAvailable}
      />
    );
  };

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
