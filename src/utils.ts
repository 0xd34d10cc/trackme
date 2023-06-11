import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api";
import { add, sub, intervalToDuration } from "date-fns";

//                           start   end     pid     exe     title
export type ActivityEntry = [number, number, number, string, string];

export interface DateRange {
  from: Date;
  to: Date;
}

export function formatDurationShort(duration: Duration): string {
  let result = "";
  if (duration.years) {
    result += `${duration.years}y `;
  }

  if (duration.months) {
    result += `${duration.months}mo `;
  }

  if (duration.days) {
    result += `${duration.days}d `;
  }

  if (duration.hours) {
    result += `${duration.hours}h `;
  }

  if (duration.minutes) {
    result += `${duration.minutes}m `;
  }

  if (duration.seconds) {
    result += `${duration.seconds}s `;
  }

  return result.trim();
}

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
    end: date.getTime(),
  });
  const day = sub(date, {
    hours: duration.hours,
    minutes: duration.minutes,
    seconds: duration.seconds,
  });
  return day;
}

async function readDurationByExe(
  range: DateRange
): Promise<[string, number][]> {
  const from = roundToDay(range.from!);
  const to = add(roundToDay(range.to!), { days: 1 });
  const activities = (await invoke("duration_by_exe", {
    from: from.getTime(),
    to: to.getTime(),
  })) as [string, number][];

  console.log(`${from.getTime()} - ${to.getTime()} => ${activities.length}`);
  console.log(activities);
  return Promise.resolve(activities);
}

export function useDurationByExe(
  range: DateRange
): [[string, number][] | null, string | null] {
  const [rows, setRows] = useState(null as null | [string, number][]);
  const [err, setError] = useState(null);
  useEffect(() => {
    const loadRows = async () => {
      try {
        const rows = await readDurationByExe(range);
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

async function readActivities(range: DateRange): Promise<ActivityEntry[]> {
  const from = roundToDay(range.from!);
  const to = add(roundToDay(range.to!), { days: 1 });
  const activities = (await invoke("select", {
    from: from.getTime(),
    to: to.getTime(),
  })) as ActivityEntry[];

  console.log(`${from} - ${to} => ${activities.length}`);
  return Promise.resolve(activities);
}

export function useActivities(
  range: DateRange
): [ActivityEntry[] | null, string | null] {
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
