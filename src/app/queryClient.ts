import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // A desktop window regaining focus is not a signal that data changed;
      // the tracker's own refresh interval covers that.
      refetchOnWindowFocus: false,
    },
  },
});
