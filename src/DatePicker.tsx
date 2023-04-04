import React, { useState, useEffect } from "react";
import { format, getTime, isDate } from "date-fns";
import { DateRange, DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { invoke } from "@tauri-apps/api";

function today(): number {
  const millisecondsInDay = 24 * 60 * 60 * 1000;
  const date = new Date().getTime();
  return date - (date % millisecondsInDay);
}

async function getActiveDates(): Promise<Set<number>> {
  const response = (await invoke("active_dates")) as [number];
  const dates = new Set<number>();
  for (const date of response) {
    dates.add(date);
  }

  console.log(`${dates.size} days active`);
  return Promise.resolve(dates);
}

export default function DatePicker({
  range,
  setRange,
}: {
  range: DateRange | undefined;
  setRange: React.Dispatch<React.SetStateAction<DateRange | undefined>>;
}) {
  const [activeDays, setActiveDays] = useState(null as null | Set<number>);
  const isDayDisabled = (date: Date) => {
    const isAvailable = activeDays === null || activeDays.has(getTime(date));
    return !isAvailable;
  };

  useEffect(() => {
    const loadActiveDays = async () => {
      const dates = await getActiveDates();
      setActiveDays(dates);
    };

    loadActiveDays();
  }, [today()]);

  let footer = <p>Please pick the first day.</p>;
  if (range?.from) {
    if (!range.to) {
      footer = <p>{format(range.from, "PPP")}</p>;
    } else if (range.to) {
      footer = (
        <p>
          {format(range.from, "PPP")}–{format(range.to, "PPP")}
        </p>
      );
    }
  }

  return (
    <DayPicker
      mode="range"
      disabled={isDayDisabled}
      selected={range}
      footer={footer}
      onSelect={setRange}
    />
  );
}
