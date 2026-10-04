import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading activity…" }: { label?: string }) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120 }}>
      <CircularProgress size={22} />
      {label !== "" && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
    </Stack>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Stack
      spacing={1}
      sx={{ alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120, px: 2 }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
          {description}
        </Typography>
      )}
      {action}
    </Stack>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <Box sx={{ height: "100%", minHeight: 120 }}>
      <Stack
        spacing={1}
        sx={{ alignItems: "flex-start", justifyContent: "center", height: "100%", px: 2 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, color: "error.main" }}>
          Could not load activity
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
          {message}
        </Typography>
        {onRetry && (
          <Button size="small" variant="outlined" onClick={onRetry}>
            Retry
          </Button>
        )}
      </Stack>
    </Box>
  );
}
