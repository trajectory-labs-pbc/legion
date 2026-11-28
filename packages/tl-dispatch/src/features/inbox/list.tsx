import { GroupHeader } from "@legion/ui/blocks/group-header";
import { Collapsible, CollapsibleContent } from "@legion/ui/components/collapsible";
import type { ReactNode } from "react";

import {
  foldedAtFirst,
  groupShowsUrgency,
  type InboxGroup,
  type InboxGrouping,
  type InboxList,
  NEEDS_YOU_GROUP_KEY,
} from "@/data/inbox/list";
import { rowFacts, rowText } from "@/data/inbox/row";
import { NeedsYouMark } from "@/parts/needs-you";
import { InboxRowView } from "./row";

/** A group's header: on the reader's own list, "Needs you" is the mark alone (R3). */
function InboxGroupHeader({ group, own }: { group: InboxGroup; own: boolean }): ReactNode {
  if (group.label === undefined) return null;
  if (own && group.key === NEEDS_YOU_GROUP_KEY) {
    return <GroupHeader title={<NeedsYouMark count={group.rows.length} />} />;
  }
  return <GroupHeader count={group.rows.length} title={group.label} />;
}

/** The list's groups, each under its 36 px sticky header, which folds it; Later starts folded. */
export function InboxGroups({
  list,
  grouping,
  now,
}: {
  list: InboxList;
  grouping: InboxGrouping;
  now: Date;
}): ReactNode {
  return list.groups.map((group) => (
    <Collapsible defaultOpen={!foldedAtFirst(group.key)} key={group.key}>
      <InboxGroupHeader group={group} own={list.own} />
      <CollapsibleContent>
        {group.rows.map((row) => {
          const facts = rowFacts(row);
          const { owner, title, preview } = rowText(row);
          return (
            <InboxRowView
              facts={facts}
              key={facts.id}
              now={now}
              owner={owner}
              preview={preview}
              title={title}
              urgencyShown={!groupShowsUrgency(grouping, group.key)}
            />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  ));
}
