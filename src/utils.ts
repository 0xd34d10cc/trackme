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

export function colorOf(id: string): string {
  const colors = [
    "#3366cc",
    "#dc3912",
    "#ff9900",
    "#109618",
    "#990099",
    "#0099c6",
    "#dd4477",
    "#66aa00",
    "#b82e2e",
    "#316395",
    "#994499",
    "#22aa99",
    "#aaaa11",
    "#6633cc",
    "#e67300",
    "#8b0707",

    // "#651067",
    // "#329262",
    // "#5574a6",
    // "#3b3eac",
    // "#b77322",
    // "#16d620",
    // "#b91383",
    // "#f4359e",
    // "#9c5935",
    // "#a9c413",
    // "#2a778d",
    // "#668d1c",
    // "#bea413",
    // "#0c5922",
    // "#743411"
  ]

  const hash = id.split("").reduce((acc, c) => {
    return c.charCodeAt(0) + ((acc << 5) - acc);
  }, 0)

  const index = Math.abs(hash % colors.length);
  return colors[index];
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

  console.log(`pie ${from.getTime()} - ${to.getTime()} => ${activities.length}`);
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

  console.log(`list ${from.getTime()} - ${to.getTime()} => ${activities.length}`);
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
