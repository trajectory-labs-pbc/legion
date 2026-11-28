import { ListRow } from "@legion/ui/blocks/list-row";
import { Avatar, AvatarFallback } from "@legion/ui/components/avatar";
import { Checkbox } from "@legion/ui/components/checkbox";
import { Time } from "@legion/ui/components/time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@legion/ui/components/tooltip";
import { Bot, Check, CircleHelp, Diamond, type LucideIcon, Reply, Sparkles } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import type { InboxRowFacts, RowUrgency } from "@/data/inbox/row";
import { PriorityBars } from "@/parts/priority";

const KIND_ICONS: Record<InboxRowFacts["type"], LucideIcon> = {
  agent: Sparkles,
  approval: Check,
  decision: Diamond,
  question: CircleHelp,
  reply: Reply,
};

/** The writer's face, or the agent glyph, with the row's kind as a badge on its corner. */
function RowAvatar({ facts }: { facts: InboxRowFacts }): ReactNode {
  const Kind = KIND_ICONS[facts.type];
  const { actor } = facts;
  return (
    <span className="relative flex">
      <Avatar className="size-9">
        <AvatarFallback>
          {actor.agent ? <Bot aria-hidden className="size-4" /> : actor.id.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span
        aria-label={facts.kindLabel}
        className="absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full bg-background text-foreground"
        role="img"
      >
        <Kind aria-hidden className="size-3" />
      </span>
    </span>
  );
}

/** An ask's urgency as bars, with the issue's priority in its tooltip and its name. */
function UrgencyBars({
  urgency,
  priority,
}: {
  urgency: RowUrgency;
  priority: InboxRowFacts["priority"];
}): ReactNode {
  const label = `Urgency: ${urgency.label}, ${priority === null ? "no priority" : `priority P${priority}`}`;
  return (
    <Tooltip>
      {/* Above the content's click area, so the pointer reaches the tooltip. */}
      <TooltipTrigger render={<span className="relative flex" />}>
        <PriorityBars label={label} rank={{ urgency: urgency.value }} />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The selection box, which takes the avatar's place on hover, on focus and while any row is
 *  selected (LR6). */
export function RowSelectBox({
  name,
  ...props
}: Omit<ComponentProps<typeof Checkbox>, "aria-label"> & { name: string }): ReactNode {
  return <Checkbox aria-label={`Select ${name}`} {...props} />;
}

/**
 * A row of the Inbox, in two lines: the unread dot before a thread's title, the owner and the
 * title, an ask's urgency bars at the right, and the preview over the time. An ask has no dot.
 */
export function InboxRowView({
  facts,
  owner,
  title,
  preview,
  now,
  ...props
}: Omit<
  ComponentProps<typeof ListRow>,
  "title" | "description" | "leading" | "end" | "descriptionEnd"
> & {
  facts: InboxRowFacts;
  /** The owning issue's key, or the document's name. */
  owner?: ReactNode;
  title: ReactNode;
  /** Line two: the question, or the newest reply. */
  preview: ReactNode;
  /** The instant the row's age is counted to. */
  now: Date;
}): ReactNode {
  const unread = facts.kind === "thread" && facts.unread;
  return (
    <ListRow
      description={preview}
      descriptionEnd={<Time now={now} value={facts.at} />}
      end={
        facts.kind === "ask" && facts.urgency !== null ? (
          <UrgencyBars priority={facts.priority} urgency={facts.urgency} />
        ) : undefined
      }
      leading={<RowAvatar facts={facts} />}
      title={
        <>
          {unread ? (
            <span
              aria-label="Unread"
              className="mr-2 inline-block size-1.5 rounded-full bg-foreground align-middle"
              role="img"
            />
          ) : null}
          {owner === undefined ? null : <span className="mr-2">{owner}</span>}
          <span>{title}</span>
        </>
      }
      {...props}
    />
  );
}
