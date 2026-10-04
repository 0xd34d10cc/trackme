/**
 * The backend reports `exe` as a full Windows NT device path, e.g.
 * `\Device\HarddiskVolume3\Program Files\...\chrome.exe`, not a basename, and
 * offers no display name or icon. The basename is the app's identity for every
 * aggregation in the UI.
 *
 * Never key anything on `pid`: Windows reuses process ids, so the same pid
 * across time is not the same process.
 */
export function appName(exe: string): string {
  const afterBackslash = exe.split("\\").pop();
  if (afterBackslash === undefined) {
    return exe;
  }
  const afterSlash = afterBackslash.split("/").pop();
  return afterSlash === undefined ? afterBackslash : afterSlash;
}

/** The backend writes idle as a synthetic activity with this exe. */
export const IDLE_EXE = "idle";

export function isIdleExe(exe: string): boolean {
  return exe === IDLE_EXE;
}

/** Label used for the idle pseudo-application in charts and lists. */
export const IDLE_LABEL = "Idle";

/** Label for the rolled-up tail of the application list. */
export const OTHER_LABEL = "Other";
