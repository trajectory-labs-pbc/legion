import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { PERSON_PATH } from "@/upstream/routes";

import type { Page } from "./page";

const PersonPage = lazyNamed(() => import("@/upstream/views/people"), "PersonPage");

export const people = {
  id: "people",
  server: "upstream",
  routes: {
    person: pageRoute({ path: PERSON_PATH, element: <PersonPage /> }),
  },
  views: ["features/people/**"],
} satisfies Page;
