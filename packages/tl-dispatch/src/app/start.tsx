// Registers upstream's kinds of writes before anything renders, so a kept write finds its kind.
import "@/upstream/write-kinds";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "@/shell/auth-gate";
import { DispatchQueryClient, queryRetry, queryRetryDelay } from "@/upstream/api";
import { ForkView } from "@/upstream/mark";
import { ErrorBoundary } from "@/upstream/shell";

import { AppProviders } from "./providers";

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
  return { stop: () => app.unmount() };
}
