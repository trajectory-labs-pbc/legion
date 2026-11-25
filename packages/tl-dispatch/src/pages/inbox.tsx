import { inboxQuery } from "@upstream-dispatch/api/queries";
import { Inbox } from "@upstream-dispatch/features/inbox/Inbox";
import { ANSWERS_PATH } from "@upstream-dispatch/features/refs/routes";
import { READING_PANE_QUERY, useMediaQuery } from "@upstream-dispatch/features/shell/useDialog";
import { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
import { linkHoverText, linkText } from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

import { lazyNamed } from "@/loading/lazy-named";
import { PageLink, Redirect } from "@/navigation/page-link";
import { pageRoute, prefetchOf } from "@/navigation/page-route";

import type { Page } from "./page";

const AnswersPage = lazyNamed(
  () => import("@upstream-dispatch/features/answers/AnswersPage"),
  "AnswersPage"
);

export function InboxPage(): ReactNode {
  useDocumentTitle("Inbox · Dispatch");
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  return (
    <section className={readingPaneShown ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Inbox</h1>
        <PageLink className={`text-sm ${linkText} ${linkHoverText}`} page={answers}>
          Answered by you
        </PageLink>
      </div>
      <Inbox />
    </section>
  );
}

/** The Inbox fills the viewport while its reading pane shows. */
export const INBOX_LAYOUT = { inbox: true, fillsViewport: "reading-pane" } as const;

const home = pageRoute({
  path: "/",
  element: <InboxPage />,
  layout: INBOX_LAYOUT,
  // The key the old Replies address sets; the Inbox reads its other keys itself.
  search: ["type"],
  prefetch: () => [prefetchOf(inboxQuery())],
});

const answers = pageRoute({ path: ANSWERS_PATH, element: <AnswersPage /> });

export const inbox = {
  id: "inbox",
  server: "upstream",
  routes: {
    home,
    answers,
    // The old Replies page is the Inbox's reply rows.
    replies: pageRoute({
      path: "/replies",
      element: <Redirect page={home} search={{ type: "reply" }} />,
    }),
  },
  views: ["features/inbox/**", "features/answers/**"],
} satisfies Page;
