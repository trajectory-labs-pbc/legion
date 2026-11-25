import { Button } from "@legion/ui/components/button";
import { Count } from "@legion/ui/components/count";
import { Heading } from "@legion/ui/components/heading";
import { NavRow } from "@legion/ui/components/nav";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { PinButton } from "@upstream-dispatch/components/PinButton";
import { unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { AgentName } from "@upstream-dispatch/features/refs/AgentName";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { HotkeyTooltip } from "@/commands/hotkey-tooltip";
import { NAV_DESTINATIONS, type NavName, navCommandName } from "@/commands/nav";
import { useCommand } from "@/commands/use-command";
import { NeedsYouMark } from "@/features/needs-you";
import { PageLink } from "@/navigation/page-link";
import { issue } from "@/pages/issue";
import { project } from "@/pages/project";
import { PeekButton } from "./peek-button";

import {
  type SectionRead,
  type SidebarAgent,
  type SidebarData,
  type SidebarItem,
  usePinnedAgent,
  useSidebarData,
} from "./sidebar-data";

/** The destinations a `G` chord opens; their rows show it in a tooltip, never at rest. */
const KEYED: ReadonlySet<NavName> = new Set(
  NAV_DESTINATIONS.flatMap((destination) => ("key" in destination ? [destination.name] : []))
);

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading className="px-2 pb-1" size="label" tone="muted">
      {children}
    </Heading>
  );
}

/** How long a read may take before its loading line shows, so a quick one draws none (ES4). */
const LOADING_DELAY_MS = 200;

/** Whether `ms` have passed since the caller mounted. */
function useAfter(ms: number): boolean {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAfter(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return after;
}

/** A read with nothing to show yet: a quiet loading line after a moment, or the failure and Retry. */
function ReadLine({ noun, retry }: { noun: string; retry: (() => void) | undefined }) {
  const late = useAfter(LOADING_DELAY_MS);
  if (retry === undefined) {
    return late ? <p className="px-2 py-1 text-xs text-muted-foreground">Loading {noun}…</p> : null;
  }
  return (
    <p className="flex items-center gap-1 py-0.5 pl-2 text-xs text-danger">
      <span className="min-w-0 flex-1">Could not load {noun}.</span>
      <Button onClick={retry} size="xs" variant="link">
        Retry
      </Button>
    </p>
  );
}

function PinnedAgentRow({
  agent,
  onNavigate,
  replace,
}: {
  agent: SidebarAgent;
  onNavigate: (() => void) | undefined;
  replace: boolean;
}) {
  const { name, viewState, unpin } = usePinnedAgent(agent.sessionId);
  return (
    <NavRow aria-current={agent.selected ? "page" : undefined} render={<li />}>
      <AgentName
        className="min-w-0 flex-1"
        onNavigate={onNavigate}
        replace={replace}
        sessionId={agent.sessionId}
        storedTitle={undefined}
      />
      <Count title={unreadRepliesLabel(agent.unread)} value={agent.unread} />
      <span className="shrink-0 text-xs text-muted-foreground">{viewState}</span>
      <PinButton label={`Unpin ${name} from the sidebar`} onClick={unpin} pinned quiet />
    </NavRow>
  );
}

function ItemRows({
  items,
  onNavigate,
  page,
}: {
  items: readonly SidebarItem[];
  onNavigate: (() => void) | undefined;
  page: typeof issue.routes.issue | typeof project.routes.overview;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.key}>
          <NavRow
            aria-current={item.current ? "page" : undefined}
            render={<PageLink onClick={onNavigate} page={page} params={{ key: item.key }} />}
          >
            <span className="shrink-0 font-medium">{item.key}</span>
            <span className="truncate text-muted-foreground">{item.text}</span>
            <Count className="ml-auto" value={item.openAsks} />
          </NavRow>
        </li>
      ))}
    </ul>
  );
}

/** The pinned agents under a heading that folds them, or the hint that says how to pin one. */
function PinnedAgents({
  read,
  onNavigate,
  replace,
}: {
  read: SectionRead<SidebarAgent>;
  onNavigate: (() => void) | undefined;
  replace: boolean;
}) {
  const [open, setOpen] = useState(true);
  const listId = useId();
  return (
    <section>
      <Heading className="pb-1" size="label" tone="muted">
        <Button
          aria-controls={listId}
          aria-expanded={open}
          className="has-[>svg]:px-2"
          onClick={() => setOpen(!open)}
          size="xs"
          variant="ghost"
        >
          Pinned agents
          {open ? <ChevronDownIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
        </Button>
      </Heading>
      <div hidden={!open} id={listId}>
        {read.status !== "success" ? (
          <ReadLine noun="pinned agents" retry={read.status === "error" ? read.retry : undefined} />
        ) : read.rows.length === 0 ? (
          <p className="px-2 text-xs text-pretty text-muted-foreground">
            Pin an agent on the Agents page, or in its live view, to keep it here.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {read.rows.map((agent) => (
              <PinnedAgentRow
                agent={agent}
                key={agent.sessionId}
                onNavigate={onNavigate}
                replace={replace}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Issues or projects under a heading, or the read's line; none when `hideEmpty` and empty. */
function ItemSection({
  heading,
  hideEmpty = false,
  noun,
  onNavigate,
  page,
  read,
}: {
  heading: string;
  hideEmpty?: boolean;
  noun: string;
  onNavigate: (() => void) | undefined;
  page: typeof issue.routes.issue | typeof project.routes.overview;
  read: SectionRead<SidebarItem>;
}) {
  if (hideEmpty && read.status === "success" && read.rows.length === 0) return null;
  return (
    <section>
      <SectionHeading>{heading}</SectionHeading>
      {read.status === "success" ? (
        <ItemRows items={read.rows} onNavigate={onNavigate} page={page} />
      ) : (
        <ReadLine noun={noun} retry={read.status === "error" ? read.retry : undefined} />
      )}
    </section>
  );
}

/** Room at the Inbox row's edge for Peek, while Peek shows. */
const PEEK_ROOM = "group-hover/peek:pr-9 group-focus-within/peek:pr-9 pointer-coarse:pr-9";

/** Peek shows on the row's hover or focus, and always on a touch screen, which has no hover. */
const PEEK_SHOWN =
  "absolute top-0 right-0 opacity-0 group-hover/peek:opacity-100 group-focus-within/peek:opacity-100 pointer-coarse:opacity-100";

/** The sidebar's rows as `data` holds them; with `peek`, the Inbox row carries Peek. */
export function SidebarView({
  data,
  onNavigate,
  peek,
}: {
  data: SidebarData;
  onNavigate: (() => void) | undefined;
  peek: boolean;
}) {
  const peekable = useCommand("global.inbox-drawer")?.enabled === true && peek;
  return (
    <nav aria-label="Navigation" className="mt-2 flex flex-col gap-4">
      <ul className="flex flex-col gap-0.5">
        {data.destinations.map(({ name, label, icon: Icon, page, current, count }) => {
          const peekHere = peekable && name === "inbox";
          const row = (
            <NavRow
              aria-current={current ? "page" : undefined}
              className={peekHere ? PEEK_ROOM : undefined}
              render={<PageLink onClick={onNavigate} page={page} />}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
              {count?.needsYou ? (
                <NeedsYouMark className="ml-auto" count={count.count ?? 0} />
              ) : (
                <Count className="ml-auto" title={count?.label} value={count?.count ?? 0} />
              )}
            </NavRow>
          );
          return (
            <li className={peekHere ? "group/peek relative" : undefined} key={name}>
              {KEYED.has(name) ? (
                <HotkeyTooltip commandId={`global.${navCommandName(name)}`} side="right">
                  {row}
                </HotkeyTooltip>
              ) : (
                row
              )}
              {peekHere ? <PeekButton className={PEEK_SHOWN} tooltipSide="right" /> : null}
              {count?.retry === undefined ? null : (
                <ReadLine noun={`the ${label} count`} retry={count.retry} />
              )}
            </li>
          );
        })}
      </ul>
      <PinnedAgents read={data.pinnedAgents} onNavigate={onNavigate} replace={data.inLiveView} />
      <ItemSection
        heading="Pinned"
        hideEmpty
        noun="pinned issues"
        onNavigate={onNavigate}
        page={issue.routes.issue}
        read={data.pinnedIssues}
      />
      <ItemSection
        heading="Projects"
        noun="projects"
        onNavigate={onNavigate}
        page={project.routes.overview}
        read={data.projects}
      />
    </nav>
  );
}

/** The sidebar: the nav table's destinations with their counts, then the pins. */
export function Sidebar({
  onNavigate,
  peek = false,
  user,
}: {
  onNavigate?: () => void;
  /** Draws Peek on the Inbox row; the narrow screen's header has its own. */
  peek?: boolean;
  user: AuthenticatedUser;
}) {
  return <SidebarView data={useSidebarData(user)} onNavigate={onNavigate} peek={peek} />;
}
