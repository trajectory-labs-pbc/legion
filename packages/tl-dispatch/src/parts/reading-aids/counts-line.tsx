import { textVariants } from "@legion/ui/lib/typography";

import { ReadFailure } from "@/data/read-failure";

import {
  type BaselineChoice,
  baselineText,
  noChangesText,
  textChangedText,
  unavailableText,
} from "./baseline";
import { BlockLink } from "./block-link";
import { type ChangeSummary, changedBlocks, countsText } from "./change-summary";
import { CompareWith } from "./compare-with";
import type { Baseline, BaselineRead } from "./use-baseline";
import type { ChangeMarks } from "./use-change-marks";

const muted = textVariants({ tone: "muted" });

const loadingChanges = (
  <span className={muted} role="status">
    Loading the changes…
  </span>
);

/** Moves to a section's first block, as a click does. */
type MoveTo = (blockId: string) => void;

/** The counts of the marks against `choice`, and a link to each section that changed. */
function Changes({
  choice,
  moveTo,
  summary,
}: {
  choice: BaselineChoice;
  moveTo: MoveTo;
  summary: ChangeSummary;
}) {
  if (changedBlocks(summary) === 0) {
    return <span className={muted}>{noChangesText(choice.version)}</span>;
  }
  return (
    <>
      <span className={`${muted} tabular-nums`}>
        {baselineText(choice)}: {countsText(summary)}
      </span>
      <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
        {summary.changedSections.map(({ blockId, title }, index) =>
          blockId === undefined ? (
            <span className={muted} key={index}>
              {title}
            </span>
          ) : (
            <BlockLink blockId={blockId} key={blockId} moveTo={moveTo}>
              <span className="line-clamp-1 [overflow-wrap:anywhere]">{title}</span>
            </BlockLink>
          )
        )}
      </span>
    </>
  );
}

/** The line for a ready baseline: the marks' counts, the last ones while its comparison runs. */
function Marks({
  choice,
  marks,
  moveTo,
}: {
  choice: BaselineChoice;
  marks: ChangeMarks | undefined;
  moveTo: MoveTo;
}) {
  switch (marks?.state) {
    case undefined:
      return <span className={muted}>{baselineText(choice)}</span>;
    case "shown":
      return marks.shown === undefined ? (
        loadingChanges
      ) : (
        <Changes choice={marks.shown.choice} moveTo={moveTo} summary={marks.shown.summary} />
      );
    case "refused":
      return <span className={muted}>{unavailableText(choice.version, "file")}</span>;
    case "failed":
      return <ReadFailure fault={{ retry: marks.retry, retrying: false }} noun="the changes" />;
  }
}

function BaselineState({
  baseline,
  marks,
  moveTo,
}: {
  baseline: Baseline;
  marks: ChangeMarks | undefined;
  moveTo: MoveTo;
}) {
  switch (baseline.state) {
    case "loading":
      return loadingChanges;
    case "failed":
      return <ReadFailure fault={baseline.fault} noun="the changes" />;
    case "none":
      return <span className={muted}>No earlier version to compare</span>;
    case "unavailable":
      return <span className={muted}>{unavailableText(baseline.version, baseline.why)}</span>;
    case "ready":
      return <Marks choice={baseline.choice} marks={marks} moveTo={moveTo} />;
  }
}

/** The line above the text that names the baseline the marks compare with, and their counts. */
export function CountsLine({
  marks,
  moveTo,
  read,
}: {
  /** What the marks show against the ready baseline; with none, the line names the baseline. */
  marks: ChangeMarks | undefined;
  /** Moves to a changed section. */
  moveTo: MoveTo;
  read: BaselineRead;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-reading-aids-counts="">
      <BaselineState baseline={read.baseline} marks={marks} moveTo={moveTo} />
      {read.changedSince === undefined ? null : (
        <span className={muted}>{textChangedText(read.changedSince)}</span>
      )}
      {/* The line's controls: each aid's own goes here, before Compare with. */}
      <div className="ms-auto flex items-center gap-2">
        <CompareWith
          onChange={read.compareWith}
          picker={read.picker}
          value={read.version}
          versions={read.versions}
        />
      </div>
    </div>
  );
}
