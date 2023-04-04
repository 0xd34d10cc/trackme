import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api";
import { add, sub, intervalToDuration } from "date-fns";
import { DateRange } from "react-day-picker";

//                           start   end     pid     exe     title
export type ActivityEntry = [number, number, number, string, string];

export function getFilename(path: string): string {
  const win = path.split("\\").pop();
  if (win === undefined) {
    return "";
  }
  const unix = win.split("/").pop();
  if (unix === undefined) {
    return "";
  }
  return unix;
}

function roundToDay(date: Date): Date {
  const duration = intervalToDuration({
    start: 0,
    end: date.getTime()
  })
  const day = sub(date, { hours: duration.hours, minutes: duration.minutes, seconds: duration.seconds })
  return day
}

export async function readActivities(range: DateRange): Promise<ActivityEntry[]> {
  const from = roundToDay(range.from!);
  const to = add(roundToDay(range.to!), { days: 1 });
  const activities = await invoke("select", {
    from: from.getTime(),
    to: to.getTime(),
  }) as ActivityEntry[];

  console.log(`${from} - ${to} => ${activities.length}`)
  return Promise.resolve(activities);
}

export function useActivities(range: DateRange): [ActivityEntry[] | null, string | null] {
  const [rows, setRows] = useState(null as null | ActivityEntry[]);
  const [err, setError] = useState(null);
  useEffect(() => {
    const loadRows = async () => {
      try {
        const rows = await readActivities(range);
        setRows(rows);
      } catch (e: any) {
        setError(e);
      }
    };
    setRows(null);
    setError(null);
    loadRows();
  }, [range.from, range.to]);

  return [rows, err];
}
