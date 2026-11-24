import {
  DispatchQueryClient,
  queryRetry,
  queryRetryDelay,
} from "@upstream-dispatch/api/query-client";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthGate } from "./shell/AuthGate";
import { AppProviders } from "./shell/providers";
import "./styles.css";

const queryClient = new DispatchQueryClient({
  defaultOptions: {
    queries: {
      retry: queryRetry,
      retryDelay: queryRetryDelay,
      // The live feed keeps reads fresh; this only skips a refetch on mount.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
});

const root = document.getElementById("root");
if (root === null) {
  throw new Error("Dispatch could not find its root element.");
}

createRoot(root).render(
  <StrictMode>
    <AppProviders client={queryClient}>
      <ErrorBoundary region="Dispatch">
        <AuthGate />
      </ErrorBoundary>
    </AppProviders>
  </StrictMode>
);
