import type { PageRoute } from "@/navigation/page-route";

/** One page of the app: its routes, which app's code draws it, and the upstream view files it maps. */
export interface Page {
  id: string;
  server: "upstream" | "fork";
  /** Named, so a link names the route it opens and is typed from its path. */
  routes: Readonly<Record<string, PageRoute>>;
  /** Files or globs under upstream's `web/src`; a page this app serves names files. */
  views: readonly string[];
  /** For a page this app serves: the query keys and fragment forms (`b-`, `top`) it reads. */
  linkForms?: { query: readonly string[]; fragments: readonly string[] };
}
