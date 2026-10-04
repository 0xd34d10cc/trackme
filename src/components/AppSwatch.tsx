import { Box } from "@mui/material";

/**
 * The colour chip that carries an application's identity in lists.
 *
 * It always sits next to the application's name, never on its own — colour is
 * a redundant channel here, which is what lets the palette stay small and what
 * satisfies the light-mode contrast warning on aqua/yellow/magenta.
 */
export function AppSwatch({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        flex: "0 0 auto",
        width: size,
        height: size,
        borderRadius: "3px",
        bgcolor: color,
      }}
    />
  );
}
