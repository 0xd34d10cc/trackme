import { useState, useEffect } from "react";
import { readTextFile, BaseDirectory } from "@tauri-apps/api/fs";

export type ActivityEntry = [string, string, Date, Date];

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

export async function readCsv(filename: string): Promise<ActivityEntry[]> {
  const content = await readTextFile(filename, { dir: BaseDirectory.Home });
  const entries = content.split("\n");
  let activities: ActivityEntry[] = [];
  for (const entry of entries) {
    if (entry.length == 0) {
      break;
    }

    const [start, end, pid, exe, title] = entry.split(",");
    const activity: ActivityEntry = [
      getFilename(exe.trim()),
      title.trim(),
      new Date(start.trim()),
      new Date(end.trim()),
    ];
    activities.push(activity);
  }

  return Promise.resolve(activities);
}

const Months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function getLogFilename(date: Date): string {
  const day = ("0" + date.getDate()).slice(-2);
  const month = Months[date.getMonth()];
  const year = date.getFullYear();
  return `trackme/${day}-${month}-${year}.csv`;
}

export function useLogFile(date: Date): [any[] | null, string | null] {
  const [rows, setRows] = useState(null as null | ActivityEntry[]);
  const [err, setError] = useState(null);
  useEffect(() => {
    const loadRows = async () => {
      try {
        const filename = getLogFilename(date);
        const rows = await readCsv(filename);
        setRows(rows);
      } catch (e: any) {
        setError(e);
      }
    };
    setRows(null);
    setError(null);
    loadRows();
  }, [date]);

  return [rows, err]
}
