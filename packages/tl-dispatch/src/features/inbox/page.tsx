import { Button } from "@legion/ui/components/button";
import { SurfaceTitle } from "@legion/ui/components/heading";
import type { ReactNode } from "react";
import { lazyNamed } from "@/loading/lazy-named";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";
import { useInboxPreview } from "@/stores/inbox-preview";
import { READING_PANE_QUERY, useDocumentTitle, useMediaQuery } from "@/upstream/shell";
import { Inbox } from "@/upstream/views/inbox/inbox";

// Only a reader who turned the preview on loads the new Inbox's code.
const InboxView = lazyNamed(() => import("./view"), "InboxView");

/** Upstream's whole Inbox under today's header, for each person who has not turned on the preview. */
function UpstreamInboxPage(): ReactNode {
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  return (
    // The Inbox's layout gives main no padding (route.tsx), so upstream's page keeps its own.
    <section className={readingPaneShown ? "flex min-h-0 flex-1 flex-col p-6" : "px-6 pt-6"}>
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

/** The Inbox: the new one while this browser's preview is on, else upstream's (R16). */
export function InboxPage(): ReactNode {
  useDocumentTitle("Inbox · Dispatch");
  return useInboxPreview((preview) => preview.on) ? <InboxView /> : <UpstreamInboxPage />;
}
