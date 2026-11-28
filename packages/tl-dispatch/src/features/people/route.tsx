import { lazyNamed } from "@/loading/lazy-named";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage } from "@/shell/page-layout";

const PersonPage = lazyNamed(() => import("@/upstream/views/people"), "PersonPage");

export const people = {
  id: "people",
  server: "upstream",
  routes: {
    person: pageRoute({ ...routes.people.person, element: <PersonPage /> }),
  },
  views: ["features/people/**"],
} satisfies AppPage<typeof routes.people>;
