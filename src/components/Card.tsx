import { Box, Paper, Stack, Typography } from "@mui/material";
import type { PaperProps, SxProps, Theme } from "@mui/material";
import type { ReactNode } from "react";

interface CardProps extends Omit<PaperProps, "title"> {
  title?: ReactNode;
  /** Right-aligned control in the header (a toggle, a segmented control…). */
  action?: ReactNode;
  contentSx?: SxProps<Theme>;
  children: ReactNode;
}

/**
 * The panel every view is built from: a hairline border, no shadow, and a
 * header row. Dense by default — the padding is a full step tighter than MUI's.
 */
export function Card({ title, action, contentSx, children, sx, ...rest }: CardProps) {
  const hasHeader = title !== undefined || action !== undefined;

  return (
    <Paper
      {...rest}
      variant="outlined"
      sx={[
        { display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {hasHeader && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 0.75,
            minHeight: 40,
            borderBottom: 1,
            borderColor: "divider",
            flex: "0 0 auto",
          }}
        >
          <Typography variant="h6" component="h2" noWrap>
            {title}
          </Typography>
          {action}
        </Stack>
      )}
      <Box sx={[{ p: 1.5, flex: 1, minHeight: 0 }, ...(Array.isArray(contentSx) ? contentSx : [contentSx])]}>
        {children}
      </Box>
    </Paper>
  );
}
