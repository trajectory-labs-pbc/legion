import { textVariants } from "@legion/ui/lib/typography";

import { ReadFailure } from "@/data/read-failure";

import { baselineText, textChangedText, unavailableText } from "./baseline";
import { CompareWith } from "./compare-with";
import type { Baseline, BaselineRead } from "./use-baseline";

const muted = textVariants({ tone: "muted" });

function BaselineState({ baseline }: { baseline: Baseline }) {
  switch (baseline.state) {
    case "loading":
      return (
        <span className={muted} role="status">
          Loading the changes…
        </span>
      );
    case "failed":
      return <ReadFailure fault={baseline.fault} noun="the changes" />;
    case "none":
      return <span className={muted}>No earlier version to compare</span>;
    case "unavailable":
      return <span className={muted}>{unavailableText(baseline.version, baseline.why)}</span>;
    case "ready":
      return <span className={muted}>{baselineText(baseline.choice)}</span>;
  }
}

/** The line above the text that names the baseline the marks compare with, in every state. */
export function CountsLine({ read }: { read: BaselineRead }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <BaselineState baseline={read.baseline} />
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
