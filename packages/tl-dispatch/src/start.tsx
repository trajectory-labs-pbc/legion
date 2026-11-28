import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DispatchQueryClient, queryRetry, queryRetryDelay } from "@/upstream/api";
import { ForkView } from "@/upstream/mark";
import { ErrorBoundary, installChunkFailureRecovery } from "@/upstream/shell";

import { AuthGate } from "./shell/auth-gate";
import { AppProviders } from "./shell/providers";

/** Draws the app in `root`. `stop` takes it down again. */
export function start(root: HTMLElement): { stop(): void } {
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
  // Before the first render, so a chunk a deploy removed reloads the page even on first paint.
  const stopRecovery = installChunkFailureRecovery();
  const app = createRoot(root);
  app.render(
    <StrictMode>
      <AppProviders client={queryClient}>
        <ErrorBoundary region="Dispatch">
          <ForkView>
            <AuthGate />
          </ForkView>
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
