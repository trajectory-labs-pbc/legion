// "Read first": the approval requests and the open decisions of the document, above its text.
import { Badge } from "@legion/ui/components/badge";
import { headingVariants, textVariants } from "@legion/ui/lib/typography";
import { memo, type ReactNode, useCallback, useId, useMemo, useState } from "react";

import {
  type AidedDocument,
  actorLabelText,
  askTurnHolder,
  askUrgency,
  askWaitingOnPerson,
  buildDispatchReference,
  documentRoute,
  type IssueAskRow,
  type TextSource,
  textSourceOf,
  URGENCY_LABELS,
  useAsksRead,
  useIssueRead,
} from "@/data/document-reads";
import { ReadFailure, useReadFailure } from "@/data/read-failure";
import { ForkView } from "@/upstream/mark";
import { PlainText } from "@/upstream/widgets/plain-text";
import { ReferenceLink } from "@/upstream/widgets/reference-link";
import { Timestamp } from "@/upstream/widgets/timestamp";

import { BlockLink } from "./block-link";
import { useBlocksInOrder } from "./editor-doc";
import { moveToBlock } from "./moves";
import { type PartsEntry, useSynced } from "./parts-slot";
import {
  type ApprovalRequest,
  type Ask,
  approvalRequests,
  isNonEmpty,
  type OpenDecision,
  openDecisionAsks,
  openDecisions,
  type RequestedDocument,
  stepDecision,
} from "./read-first-lists";

export interface ReadFirstState {
  readonly asks: ReturnType<typeof useAsksRead>;
  /** The key of the issue that owns the document; absent for a project's document. */
  readonly issueKey?: string;
  readonly requests: readonly ApprovalRequest[];
  readonly decisions: readonly OpenDecision[];
  /** Whether the server's first sync of the document has completed. */
  readonly loaded: boolean;
  /** Moves to a decision's block; a click also sets its `#b-` anchor. */
  readonly moveTo: (blockId: string, by: "click" | "key") => void;
  /** The next or the previous decision's move, wrapping; absent with no decision. */
  readonly step?: (by: 1 | -1) => void;
}

/** What "Read first" lists for the document an aided editor shows, and its moves. */
export function useReadFirst(entry: PartsEntry, document: AidedDocument): ReadFirstState {
  const { artifactId } = document;
  const issueKey = document.owner.kind === "issue" ? document.owner.key : undefined;
  const asks = useAsksRead(document);
  const issueRead = useIssueRead(issueKey);
  const loaded = useSynced(artifactId);
  const [current, setCurrent] = useState<string>();
  const requests = useMemo(
    () => approvalRequests(asks.data ?? [], artifactId, issueRead.data?.artifacts ?? []),
    [asks.data, artifactId, issueRead.data?.artifacts]
  );
  const open = useMemo(
    () => openDecisionAsks(asks.data ?? [], artifactId),
    [asks.data, artifactId]
  );
  const shown = useBlocksInOrder(entry.editor.view, open);
  const decisions = useMemo(() => openDecisions(open, shown), [open, shown]);
  const moveTo = useCallback(
    (blockId: string, by: "click" | "key") => {
      setCurrent(blockId);
      moveToBlock(entry, blockId, by);
    },
    [entry]
  );
  const step = isNonEmpty(decisions)
    ? (by: 1 | -1) => moveTo(stepDecision(decisions, current, by).blockId, "key")
    : undefined;
  return { asks, decisions, issueKey, loaded, moveTo, requests, step };
}

const caption = textVariants({ size: "caption", tone: "muted" });

/** Whether the asks read answered `ask` as an issue's row, which carries its newest reply. */
const isIssueRow = (ask: Ask): ask is IssueAskRow => "last_reply" in ask;

/** Whom an open request waits on: a person, or the agent whose turn it is. */
function waitingOn(ask: Ask): string | undefined {
  const holder = askTurnHolder(ask, isIssueRow(ask) ? (ask.last_reply ?? undefined) : undefined);
  if (holder === null) return undefined;
  return holder === "you" ? (askWaitingOnPerson(ask) ?? "you") : actorLabelText(holder);
}

const CONTROL_CHARACTERS = /\p{Cc}/gu;

/** A question's plain words without control characters, as written until they are read. */
function Question({
  ask,
  children,
  source,
  surface,
}: {
  ask: Ask;
  children: (words: string) => ReactNode;
  source: TextSource | undefined;
  surface: "approval-ask-question" | "document-open-decision";
}) {
  const markdown = ask.question.replace(CONTROL_CHARACTERS, "");
  return (
    <PlainText markdown={markdown} source={source} surface={surface} tree={ask.question_tree}>
      {(words) => <ForkView>{children(words ?? markdown)}</ForkView>}
    </PlainText>
  );
}

function DocumentName({ document }: { document: RequestedDocument }) {
  const label = `${document.name} v${document.version}`;
  const { link } = document;
  if (link === undefined) return <span>{label}</span>;
  return <ReferenceLink label={label} reference={buildDispatchReference(documentRoute(link))} />;
}

const RequestRow = memo(function RequestRow({
  request,
  source,
}: {
  request: ApprovalRequest;
  source: TextSource | undefined;
}) {
  const { ask } = request;
  const waiting = waitingOn(ask);
  const approved = ask.approval?.approved?.version;
  return (
    <li className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
      <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${textVariants()}`}>
        <Badge variant="outline">Approval</Badge>
        {request.documents.map((document) => (
          <DocumentName document={document} key={document.artifactId} />
        ))}
        <span className={caption}>
          {approved === undefined ? "Not approved before" : `Approved before: v${approved}`}
        </span>
        <span className={caption}>{URGENCY_LABELS[askUrgency(ask.urgency)]}</span>
        <Timestamp at={ask.created_at} className={`${caption} tabular-nums`} />
        {waiting === undefined ? null : <span className={caption}>Waiting on {waiting}</span>}
      </div>
      <Question ask={ask} source={source} surface="approval-ask-question">
        {(words) => (
          <p className={`line-clamp-2 [overflow-wrap:anywhere] ${caption}`} title={words}>
            {words}
          </p>
        )}
      </Question>
    </li>
  );
});

const DecisionRow = memo(function DecisionRow({
  decision,
  moveTo,
  source,
}: {
  decision: OpenDecision;
  moveTo: ReadFirstState["moveTo"];
  source: TextSource | undefined;
}) {
  return (
    <li className="flex min-h-11 min-w-0 items-center gap-2 px-2 py-1.5 md:min-h-0">
      <Badge variant="outline">Decision</Badge>
      <Question ask={decision.ask} source={source} surface="document-open-decision">
        {(words) => (
          <BlockLink
            blockId={decision.blockId}
            moveTo={(blockId) => moveTo(blockId, "click")}
            title={words}
          >
            <span className="line-clamp-2 [overflow-wrap:anywhere]">{words}</span>
          </BlockLink>
        )}
      </Question>
      <span className={caption}>{URGENCY_LABELS[askUrgency(decision.ask.urgency)]}</span>
    </li>
  );
});

function Rows({ state, source }: { state: ReadFirstState; source: TextSource | undefined }) {
  const failure = useReadFailure(state.asks);
  if (failure !== undefined)
    return <ReadFailure fault={failure} noun="the requests and decisions" />;
  if (state.requests.length === 0 && state.decisions.length === 0) {
    return (
      <p className={`px-2 ${caption}`}>
        {state.asks.data === undefined || !state.loaded
          ? "Loading…"
          : "No open requests or decisions"}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {state.requests.map((request) => (
        <RequestRow key={request.ask.id} request={request} source={source} />
      ))}
      {state.decisions.map((decision) => (
        <DecisionRow
          decision={decision}
          key={decision.ask.id}
          moveTo={state.moveTo}
          source={source}
        />
      ))}
    </ul>
  );
}

/** "Read first", drawn in the parts' root above the document's text. */
export function ReadFirst({ document, state }: { document: AidedDocument; state: ReadFirstState }) {
  const title = useId();
  // A `#id` in a question names an ask of this document, as in upstream's navigator.
  const source = useMemo(
    () => textSourceOf("artifact", document.artifactId, state.issueKey),
    [document.artifactId, state.issueKey]
  );
  return (
    <section
      aria-labelledby={title}
      className="flex flex-col gap-1 rounded-lg border border-border p-2"
      data-reading-aids-read-first=""
    >
      <p className={`px-2 ${headingVariants({ size: "label", tone: "muted" })}`} id={title}>
        Read first
      </p>
      <Rows source={source} state={state} />
    </section>
  );
}
