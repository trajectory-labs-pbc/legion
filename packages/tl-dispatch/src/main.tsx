import { QueryClientProvider } from "@tanstack/react-query";
import {
  DispatchQueryClient,
  queryRetry,
  queryRetryDelay,
} from "@upstream-dispatch/api/query-client";
import {
  DeploymentResilience,
  installChunkFailureRecovery,
} from "@upstream-dispatch/features/shell/DeploymentResilience";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthGate } from "./shell/AuthGate";
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

installChunkFailureRecovery();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DeploymentResilience />
        <ErrorBoundary region="Dispatch">
          <AuthGate />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
