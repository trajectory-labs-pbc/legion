// The app as the tests draw it. Apart from tests/react.ts, which every test reads, so that only a
// test that draws the app loads its route map.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { pages } from "@/app/routes";
import { createRouteTree, RouteProvider } from "@/navigation/route-tree";
import type { PageLayout } from "@/shell/page-layout";
import { MemoryNavigationProvider, type Move } from "./navigation";

// A feature's test draws the shell from here: the features are above the shell.
export { AppShell } from "@/shell/app-shell";

/** The page and route the app's route map gives an address. */
export const { pageAt } = createRouteTree<PageLayout, (typeof pages)[number]>(pages);

/**
 * Draws `element` with the app's providers: its query client, a router held at `path` (`move`
 * takes it elsewhere) and the app's pages.
 */
export function renderApp(
  element: ReactNode,
  {
    path = "/",
    client = new QueryClient(),
    move,
  }: { path?: string; client?: QueryClient; move?: Move } = {}
) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryNavigationProvider move={move} path={path}>
        <RouteProvider pages={pages}>{element}</RouteProvider>
      </MemoryNavigationProvider>
    </QueryClientProvider>
  );
}
