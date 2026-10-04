import { Chip, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../../components/Card";
import { ErrorState, LoadingState } from "../../components/states";
import { qk } from "../../lib/queryKeys";
import { api } from "../../lib/tauri";

/**
 * Read-only config view.
 *
 * Editing settings is not part of P0 — and note that the backend's `set_config`
 * only swaps the in-memory config, so it would not survive a restart anyway.
 * This exists so the blacklist and matchers remain inspectable.
 */
export function SettingsView() {
  const query = useQuery({
    queryKey: qk.config(),
    queryFn: () => api.getConfig(),
    staleTime: Infinity,
  });

  if (query.isLoading) {
    return <LoadingState label="Loading configuration…" />;
  }

  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const config = query.data;
  if (!config) {
    return null;
  }

  return (
    <Stack sx={{ p: 1.5, gap: 1, overflowY: "auto" }}>
      <Card title="Storage">
        <Typography variant="body2" color="text.secondary">
          {config.storage.location ?? "Default (data.duckdb in the trackme home directory)"}
        </Typography>
      </Card>

      <Card title="Blacklist">
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          {config.blacklist.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing is filtered out.
            </Typography>
          ) : (
            config.blacklist.map((tag) => <Chip key={tag} size="small" label={tag} />)
          )}
        </Stack>
      </Card>

      <Card title="Matchers">
        <Stack spacing={0.5}>
          {config.matchers.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No matchers defined.
            </Typography>
          ) : (
            config.matchers.map((matcher) => (
              <Stack key={matcher.name} direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
                <Chip size="small" label={matcher.name} />
                <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                  {matcher.matcher}
                </Typography>
              </Stack>
            ))
          )}
        </Stack>
      </Card>

      <Typography variant="caption" color="text.secondary">
        Editing settings is not available yet, and changes would not persist across restarts.
      </Typography>
    </Stack>
  );
}
