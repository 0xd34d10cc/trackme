import { Button, Popover, Paper } from "@mui/material";
import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useActiveDates } from "../lib/hooks/useActiveDates";
import { DAY_MS, rangeWindow, startOfUtcDay, type DayWindow } from "../lib/time";
import { pickerPaperSx } from "./pickerStyles";

/** The upper bound on a selectable range — mirrors `clampRange`'s cap. */
const MAX_RANGE_DAYS = 370;

/**
 * A selection in progress — mirrors day-picker's own `DateRange`, where `from`
 * is required (though possibly unset) and `to` only appears after the 2nd click.
 */
interface DraftRange {
  from: Date | undefined;
  to?: Date | undefined;
}

/**
 * The shared range calendar popover.
 *
 * Unlike the single-day picker, days with no activity are *not* disabled: a
 * range has to be able to span a gap, or a week off would be unselectable. The
 * `hasActivity` dot is kept as a hint, not a constraint.
 */
export function RangePicker({
  range,
  label,
  onApply,
}: {
  range: DayWindow;
  label: string;
  onApply: (range: DayWindow) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data: activeDates } = useActiveDates();

  /**
   * The selection as the calendar is building it.
   *
   * This has to live here. Supplying `onSelect` makes DayPicker fully
   * controlled: it renders whatever `selected` holds and never records the
   * click itself. Feeding it only the committed range would mean every click
   * sees a complete range and — with `resetOnSelect` — restarts the selection
   * at `{ from: clicked, to: undefined }`, so the range could never be
   * finished. Holding the half-selection lets the second click complete it.
   */
  const [draft, setDraft] = useState<DraftRange | undefined>(undefined);

  const committed = (): DraftRange => ({
    // The picker's upper bound is inclusive; the store's window is half-open.
    from: new Date(range.from),
    to: new Date(range.to - DAY_MS),
  });

  const modifiers = useMemo(() => {
    const activeSet = new Set(activeDates ?? []);
    return {
      hasActivity: (day: Date) => activeSet.has(startOfUtcDay(day.getTime())),
    };
  }, [activeDates]);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(event) => {
          // Start each opening from the range actually in effect, discarding any
          // half-finished selection from a previous visit.
          setDraft(committed());
          setAnchorEl(event.currentTarget);
        }}
        sx={{ textTransform: "none", fontWeight: 500, minWidth: 220, justifyContent: "center" }}
      >
        {label}
      </Button>

      <Popover
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Paper sx={pickerPaperSx}>
          <DayPicker
            mode="range"
            numberOfMonths={2}
            max={MAX_RANGE_DAYS}
            resetOnSelect
            selected={draft}
            defaultMonth={new Date(range.from)}
            modifiers={modifiers}
            modifiersClassNames={{ hasActivity: "rdp-hasActivity" }}
            onSelect={(next) => {
              setDraft(next);
              // Only a finished range is worth applying; the first click just
              // sets the start and leaves the calendar open.
              if (next?.from && next.to) {
                onApply(rangeWindow(next.from.getTime(), next.to.getTime() + DAY_MS));
                setAnchorEl(null);
              }
            }}
          />
        </Paper>
      </Popover>
    </>
  );
}
