import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/states";
import { useRangeModel, type RangeModel } from "../../lib/hooks/useRangeModel";

/**
 * The loading / empty / error framing every range view shares.
 *
 * A range is "empty" only when it holds no rows at all — an all-idle range is
 * still data, so it renders normally.
 */
export function RangeBody({
  state,
  emptyTitle,
  emptyDescription,
  children,
}: {
  state: ReturnType<typeof useRangeModel>;
  emptyTitle: string;
  emptyDescription?: string;
  children: (model: RangeModel) => ReactNode;
}) {
  const { model, error, refetch } = state;

  if (error) {
    return (
      <Box sx={{ height: "100%", p: 1.5 }}>
        <ErrorState error={error} onRetry={refetch} />
      </Box>
    );
  }

  if (!model) {
    return (
      <Box sx={{ height: "100%", p: 1.5 }}>
        <LoadingState label="Loading range…" />
      </Box>
    );
  }

  if (!model.hasData) {
    return (
      <Box sx={{ height: "100%", p: 1.5 }}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Box>
    );
  }

  return <Box sx={{ height: "100%", minHeight: 0 }}>{children(model)}</Box>;
}
