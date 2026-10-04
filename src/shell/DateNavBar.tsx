import { ChevronLeft, ChevronRight, Today as TodayIcon } from "@mui/icons-material";
import { Box, Button, IconButton, Popover, Paper, Stack } from "@mui/material";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useUi } from "../app/store";
import { useActiveDates } from "../lib/hooks/useActiveDates";
import { startOfUtcDay } from "../lib/time";

/**
 * UC-04: moving between days.
 *
 * Days that hold no activity are disabled and days that do get a dot, so "no
 * data" reads differently from "broken". Both the disabling and the dot compare
 * UTC midnights against `active_dates`, which already buckets by UTC day — so
 * the membership test is exact rather than off by a timezone.
 */
export function DateNavBar() {
  const date = useUi((state) => state.date);
  const setDate = useUi((state) => state.setDate);
  const stepDate = useUi((state) => state.stepDate);
  const goToday = useUi((state) => state.goToday);

  const { data: activeDates } = useActiveDates();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const today = startOfUtcDay(Date.now());
  const isToday = date === today;

  const activeSet = useMemo(() => new Set(activeDates ?? []), [activeDates]);
  const hasHistory = activeSet.size > 0;

  const isDayDisabled = useCallback(
    (day: Date) => hasHistory && !activeSet.has(startOfUtcDay(day.getTime())),
    [activeSet, hasHistory],
  );

  const modifiers = useMemo(
    () => ({
      hasActivity: (day: Date) => activeSet.has(startOfUtcDay(day.getTime())),
    }),
    [activeSet],
  );

  // ← / → step a day, unless the user is typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepDate(-1);
      } else if (event.key === "ArrowRight" && !isToday) {
        event.preventDefault();
        stepDate(1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepDate, isToday]);

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <IconButton size="small" title="Previous day (←)" onClick={() => stepDate(-1)}>
        <ChevronLeft fontSize="small" />
      </IconButton>

      <Button
        size="small"
        variant="outlined"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{ textTransform: "none", fontWeight: 500, minWidth: 200, justifyContent: "center" }}
      >
        {format(new Date(date), "EEEE, MMM d, yyyy")}
      </Button>

      <IconButton
        size="small"
        title="Next day (→)"
        onClick={() => stepDate(1)}
        disabled={isToday}
      >
        <ChevronRight fontSize="small" />
      </IconButton>

      <Button
        size="small"
        startIcon={<TodayIcon fontSize="small" />}
        onClick={goToday}
        disabled={isToday}
        sx={{ textTransform: "none" }}
      >
        Today
      </Button>

      <Popover
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Paper
          sx={{
            p: 1,
            bgcolor: "background.paper",
            // Drive the picker from MUI's CSS variables so it follows the
            // active colour scheme (a JS palette value would be the *default*
            // scheme's literal and go stale on toggle).
            "& .rdp-root": {
              "--rdp-accent-color": "var(--mui-palette-primary-main)",
              "--rdp-accent-background-color":
                "rgb(var(--mui-palette-primary-mainChannel) / 0.25)",
              "--rdp-today-color": "var(--mui-palette-primary-main)",
              color: "var(--mui-palette-text-primary)",
            },
            "& .rdp-day_button": { position: "relative" },
            "& .rdp-day": { color: "inherit" },
            "& .rdp-disabled": { opacity: 0.3 },
            "& .rdp-selected .rdp-day_button": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
            "& .rdp-hasActivity .rdp-day_button::after": {
              content: '""',
              position: "absolute",
              bottom: 3,
              left: "50%",
              transform: "translateX(-50%)",
              width: 4,
              height: 4,
              borderRadius: "50%",
              bgcolor: "primary.main",
            },
          }}
        >
          <Box>
            {/* `modifiersClassNames` values are applied verbatim — react-day-picker
                does not prefix them — so the name must match the selector above. */}
            <DayPicker
              mode="single"
              selected={new Date(date)}
              defaultMonth={new Date(date)}
              disabled={isDayDisabled}
              modifiers={modifiers}
              modifiersClassNames={{ hasActivity: "rdp-hasActivity" }}
              onSelect={(day) => {
                if (day) {
                  setDate(day.getTime());
                  setAnchorEl(null);
                }
              }}
            />
          </Box>
        </Paper>
      </Popover>
    </Stack>
  );
}
