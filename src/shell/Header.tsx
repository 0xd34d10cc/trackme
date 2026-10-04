import { Box, Stack, Typography } from "@mui/material";
import type { RouteDef } from "../app/routes";
import { DateNavBar } from "./DateNavBar";
import { RangeNavBar } from "./RangeNavBar";

/**
 * The view's title bar, with the shared navigation control on the right.
 *
 * Which control appears is decided entirely by the route's `scope` — the single
 * hook a new view uses to opt in, so the shell never needs editing again.
 */
export function Header({ route }: { route: RouteDef }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        px: 1.5,
        py: 1,
        minHeight: 56,
        flex: "0 0 auto",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="h6" component="h1">
        {route.label}
      </Typography>
      <Box sx={{ flex: 1 }} />
      {route.scope === "day" && <DateNavBar />}
      {route.scope === "range" && <RangeNavBar />}
    </Stack>
  );
}
