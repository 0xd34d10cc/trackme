import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api";
import { add, sub, intervalToDuration } from "date-fns";

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

export async function readActivities(date: Date): Promise<ActivityEntry[]> {
  const duration = intervalToDuration({
    start: 0,
    end: date.getTime()
  })
  const day = sub(date, { hours: duration.hours, minutes: duration.minutes, seconds: duration.seconds })
  const nextDay = add(day, { days: 1 })

  const activities = await invoke("select", {
    from: day.getTime(),
    to: nextDay.getTime(),
  }) as ActivityEntry[];

  console.log(`${date} => ${activities.length}`)
  return Promise.resolve(activities);
}

export function useActivities(date: Date): [ActivityEntry[] | null, string | null] {
  const [rows, setRows] = useState(null as null | ActivityEntry[]);
  const [err, setError] = useState(null);
  useEffect(() => {
    const loadRows = async () => {
      try {
        const rows = await readActivities(date);
        setRows(rows);
      } catch (e: any) {
        setError(e);
      }
    };
    setRows(null);
    setError(null);
    loadRows();
  }, [date]);

  return [rows, err];
}
