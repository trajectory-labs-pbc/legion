import type { ReactNode } from "react";

export interface PageRoute {
  path: string;
  element: ReactNode;
}

/** One page of the app: its routes, which app's code draws it, and the upstream view files it maps. */
export interface Page {
  id: string;
  server: "upstream" | "fork";
  routes: readonly PageRoute[];
  /** Globs under upstream's `web/src`. */
  views: readonly string[];
}
