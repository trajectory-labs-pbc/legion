import { EmptyState } from "@legion/ui/blocks/states";
import type { ReactNode } from "react";

import { credentialsHoldEmptyList } from "@/data/inbox/empty-list";
import { useInboxList } from "@/data/inbox/list";
import { useCredentialRequests } from "@/data/inbox/reads";
import { useInboxAddress } from "@/navigation/hooks";
import { PageLink } from "@/navigation/page-link";
import { routes } from "@/navigation/routes";
import { ViewHeader } from "@/parts/view-header";
import { emptyList } from "./empty-list";
import { InboxGroups } from "./list";
import { InboxListBoundary } from "./list-states";

const TABS = [
  { label: "Inbox", link: <PageLink page={routes.inbox.home} />, current: true },
  { label: "Answered by you", link: <PageLink page={routes.inbox.answers} />, current: false },
];

/**
 * The new Inbox, which the preview draws: the header, and the list of the address with its
 * groups. The Dismissed view, the parts above the list and the reading pane come next.
 */
export function InboxView(): ReactNode {
  const address = useInboxAddress();
  const list = useInboxList(address);
  const credentials = useCredentialRequests();
  const empty =
    list.state === "ready" && list.data.groups.length === 0
      ? emptyList({
          address,
          words: list.data.words,
          viewer: list.data.viewer,
          agentName: undefined,
          credentialsHold: credentialsHoldEmptyList(credentials),
        })
      : undefined;
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ViewHeader tabs={TABS} title="Inbox" />
      {address.show === "dismissed" ? null : (
        <InboxListBoundary
          empty={
            empty === undefined ? null : (
              <EmptyState description={empty.sentence} title={empty.title} />
            )
          }
          read={list}
        >
          {list.state === "ready" ? (
            <InboxGroups grouping={address.group} list={list.data} />
          ) : null}
        </InboxListBoundary>
      )}
    </section>
  );
}
