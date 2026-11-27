import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { NavigationProvider } from "@/navigation/provider";
import { RouteProvider } from "@/navigation/route-tree";
import { DeploymentResilience } from "@/upstream/shell";

import { pages } from "./routes";

/** What every screen of the app sits in: its reads, its router, its pages and the deploy watch. */
export function AppProviders({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <NavigationProvider>
        <RouteProvider pages={pages}>
          <DeploymentResilience />
          {children}
        </RouteProvider>
      </NavigationProvider>
    </QueryClientProvider>
  );
}
