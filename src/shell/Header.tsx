import { Box, Stack, Typography } from "@mui/material";
import type { RouteDef } from "../app/routes";
import { DateNavBar } from "./DateNavBar";

/**
 * The view's title bar, with the shared date navigator on the right.
 *
 * The date bar appears only for `dateScoped` routes — that is the single hook
 * future use cases use to opt in, so the shell never needs editing again.
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
      {route.dateScoped && <DateNavBar />}
    </Stack>
  );
}
