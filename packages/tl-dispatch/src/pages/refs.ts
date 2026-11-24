import type { Page } from "./page";

/** Reference links, previews and Markdown bodies: no route of its own, drawn on every page. */
export const refs: Page = {
  id: "refs",
  server: "upstream",
  routes: [],
  views: ["features/refs/**"],
};
