import { ChevronLeft, ChevronRight, Today as TodayIcon } from "@mui/icons-material";
import { Button, IconButton, Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useUi } from "../app/store";
import { formatRangeLabel } from "../lib/format";
import { DAY_MS, startOfUtcDay, type RangePreset } from "../lib/time";
import { RangePicker } from "./RangePicker";

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "mtd", label: "MTD" },
  { value: "ytd", label: "YTD" },
];

/**
 * The header control for range-scoped views (Overview, Applications, Weekday).
 *
 * The range is shared state, so switching between those views keeps whatever
 * window the user set here — the range counterpart of `DateNavBar`.
 */
export function RangeNavBar() {
  const range = useUi((state) => state.range);
  const rangePreset = useUi((state) => state.rangePreset);
  const setRange = useUi((state) => state.setRange);
  const setRangePreset = useUi((state) => state.setRangePreset);
  const stepRange = useUi((state) => state.stepRange);

  const tomorrow = startOfUtcDay(Date.now()) + DAY_MS;
  const isAtToday = range.to >= tomorrow;

  // On a preset, "today" simply recomputes that preset ending now; on a custom
  // range the span is preserved and slid forward, so it stays custom.
  const goToToday = () => {
    if (rangePreset === "custom") {
      setRange({ from: tomorrow - (range.to - range.from), to: tomorrow }, "custom");
    } else {
      setRangePreset(rangePreset);
    }
  };

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <IconButton size="small" title="Previous period" onClick={() => stepRange(-1)}>
        <ChevronLeft fontSize="small" />
      </IconButton>

      <RangePicker
        range={range}
        label={formatRangeLabel(range.from, range.to)}
        onApply={(next) => setRange(next, "custom")}
      />

      <IconButton
        size="small"
        title="Next period"
        onClick={() => stepRange(1)}
        disabled={isAtToday}
      >
        <ChevronRight fontSize="small" />
      </IconButton>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={rangePreset}
        onChange={(_event, value: RangePreset | null) => {
          if (value !== null) {
            setRangePreset(value);
          }
        }}
        aria-label="Range preset"
        sx={{ ml: 0.5 }}
      >
        {PRESETS.map((preset) => (
          <ToggleButton
            key={preset.value}
            value={preset.value}
            sx={{ px: 1, py: 0.25, fontSize: 11 }}
          >
            {preset.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Button
        size="small"
        startIcon={<TodayIcon fontSize="small" />}
        onClick={goToToday}
        disabled={isAtToday}
        sx={{ textTransform: "none" }}
      >
        Today
      </Button>
    </Stack>
  );
}
