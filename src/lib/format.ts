const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact human duration, at most two units: "2d 3h", "6h 42m", "42m 10s",
 * "3s". Two units keeps KPI tiles and list rows from jittering in width as the
 * value changes.
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  if (total < SECOND) {
    return "0s";
  }

  const units: Array<[number, string]> = [
    [DAY, "d"],
    [HOUR, "h"],
    [MINUTE, "m"],
    [SECOND, "s"],
  ];

  const parts: string[] = [];
  let rest = total;
  for (const [size, suffix] of units) {
    const value = Math.floor(rest / size);
    rest -= value * size;
    if (value > 0) {
      parts.push(`${value}${suffix}`);
    }
    if (parts.length === 2) {
      break;
    }
  }

  return parts.join(" ");
}

/** Clock time as HH:mm:ss, in UTC. */
export function formatClock(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19);
}

/** Clock time as HH:mm, in UTC — for axis ticks. */
export function formatClockShort(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

/** A fraction (0..1) as a percentage. Keeps one decimal below 10%. */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return "0%";
  }
  if (fraction < 0.001) {
    return "<0.1%";
  }
  const percent = fraction * 100;
  return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}
