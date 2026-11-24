import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeploymentResilience } from "@upstream-dispatch/features/shell/DeploymentResilience";
import type { ReactNode } from "react";

import { NavigationProvider } from "@/navigation/provider";

/** What every screen of the app sits in: its reads, its router and the deploy watch. */
export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <NavigationProvider>
        <DeploymentResilience />
        {children}
      </NavigationProvider>
    </QueryClientProvider>
  );
}
