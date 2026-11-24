import { NotFoundPage } from "@upstream-dispatch/features/shell/NotFoundPage";

import type { Page } from "./page";

export const notFound: Page = {
  id: "not-found",
  server: "upstream",
  routes: [{ path: "*", element: <NotFoundPage /> }],
  views: ["features/shell/NotFoundPage.tsx"],
};
