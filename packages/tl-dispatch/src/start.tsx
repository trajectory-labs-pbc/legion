import { DispatchQueryClient, queryRetryDelay } from "@upstream-dispatch/api/query-client";
import { installChunkFailureRecovery } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { readRetry } from "./features/read-failure";
import { AuthGate } from "./shell/auth-gate";
import { AppProviders } from "./shell/providers";

/** Draws the app in `root`. `stop` takes it down again. */
export function start(root: HTMLElement): { stop(): void } {
  const queryClient = new DispatchQueryClient({
    defaultOptions: {
      queries: {
        retry: readRetry,
        retryDelay: queryRetryDelay,
        // The live feed keeps reads fresh; this only skips a refetch on mount.
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
    },
  });
  // Before the first render, so a chunk a deploy removed reloads the page even on first paint.
  const stopRecovery = installChunkFailureRecovery();
  const app = createRoot(root);
  app.render(
    <StrictMode>
      <AppProviders client={queryClient}>
        <ErrorBoundary region="Dispatch">
          <AuthGate />
        </ErrorBoundary>
      </AppProviders>
    </StrictMode>
  );
  return {
    stop() {
      app.unmount();
      stopRecovery();
    },
  };
}
