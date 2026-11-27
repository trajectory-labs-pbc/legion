import { Button } from "@legion/ui/components/button";
import { SurfaceTitle } from "@legion/ui/components/heading";
import type { ReactNode } from "react";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";
import { READING_PANE_QUERY, useDocumentTitle, useMediaQuery } from "@/upstream/shell";
import { Inbox } from "@/upstream/views/inbox/inbox";

export function InboxPage(): ReactNode {
  useDocumentTitle("Inbox · Dispatch");
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  return (
    <section className={readingPaneShown ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SurfaceTitle size="page">Inbox</SurfaceTitle>
        <Button render={<PageLink page={routes.inbox.answers} />} size="sm" variant="link">
          Answered by you
        </Button>
      </div>
      <Inbox />
    </section>
  );
}
