import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NavigationProvider } from "@/navigation/provider";
import { DeploymentResilience } from "@/upstream/shell";

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
