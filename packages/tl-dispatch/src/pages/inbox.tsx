import { Inbox } from "@upstream-dispatch/features/inbox/Inbox";
import { ANSWERS_PATH, buildInboxPath } from "@upstream-dispatch/features/refs/routes";
import { READING_PANE_QUERY, useMediaQuery } from "@upstream-dispatch/features/shell/useDialog";
import { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
import { linkHoverText, linkText } from "@upstream-dispatch/theme/classes";
import { lazy, type ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";

import type { Page } from "./page";

const AnswersPage = lazy(() =>
  import("@upstream-dispatch/features/answers/AnswersPage").then((module) => ({
    default: module.AnswersPage,
  }))
);

export function InboxPage(): ReactNode {
  useDocumentTitle("Inbox · Dispatch");
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  return (
    <section className={readingPaneShown ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Inbox</h1>
        <Link className={`text-sm ${linkText} ${linkHoverText}`} to={ANSWERS_PATH}>
          Answered by you
        </Link>
      </div>
      <Inbox />
    </section>
  );
}

export const inbox: Page = {
  id: "inbox",
  server: "upstream",
  routes: [
    { path: "/", element: <InboxPage /> },
    { path: ANSWERS_PATH, element: <AnswersPage /> },
    // The old Replies page is the Inbox's reply rows.
    {
      path: "/replies",
      element: <Navigate replace to={buildInboxPath({ filters: { type: ["reply"] } })} />,
    },
  ],
  // The rest of the Inbox is shared with the shell's drawer (views.ts, sharedViews.inbox).
  views: ["features/answers/**"],
};
