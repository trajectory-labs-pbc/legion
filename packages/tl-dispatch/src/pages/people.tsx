import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";

import type { Page } from "./page";

const PersonPage = lazyNamed(
  () => import("@upstream-dispatch/features/people/PersonPage"),
  "PersonPage"
);

export const people = {
  id: "people",
  server: "upstream",
  routes: {
    person: pageRoute({ path: "/people/:login", element: <PersonPage /> }),
  },
  views: ["features/people/**"],
} satisfies Page;
