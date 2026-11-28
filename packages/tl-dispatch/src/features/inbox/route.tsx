import { prefetchOf } from "@/data/prefetch";
import { lazyNamed } from "@/loading/lazy-named";
import { Redirect } from "@/navigation/page-link";
import { pageRoute } from "@/navigation/page-route";
import { routes } from "@/navigation/routes";
import type { AppPage, PageLayout } from "@/shell/page-layout";
import { inboxQuery } from "@/upstream/queries";
// The home page draws at first paint (tests/layers.table.ts, EAGER).
import { InboxPage } from "./page";

const AnswersPage = lazyNamed(() => import("@/upstream/views/inbox/answers"), "AnswersPage");

/** The Inbox fills the viewport while its reading pane shows, and its list meets the panel's
 *  edges; upstream's page pads itself. */
const INBOX_LAYOUT = {
  inbox: true,
  flush: true,
  fillsViewport: "reading-pane",
} as const satisfies PageLayout;

export const inbox = {
  id: "inbox",
  server: "upstream",
  routes: {
    home: pageRoute({
      ...routes.inbox.home,
      element: <InboxPage />,
      layout: INBOX_LAYOUT,
      prefetch: () => [prefetchOf(inboxQuery())],
    }),
    answers: pageRoute({ ...routes.inbox.answers, element: <AnswersPage /> }),
    // The old Replies page is the Inbox's reply rows.
    replies: pageRoute({
      ...routes.inbox.replies,
      element: <Redirect page={routes.inbox.home} search={{ type: "reply" }} />,
    }),
    credentials: pageRoute({
      ...routes.inbox.credentials,
      element: <InboxPage />,
      layout: INBOX_LAYOUT,
    }),
  },
  // The credentials folder holds the files no other page names: the machine login page and
  // Settings name theirs.
  views: ["features/inbox/**", "features/answers/**", "features/credentials/**"],
} satisfies AppPage<typeof routes.inbox>;
