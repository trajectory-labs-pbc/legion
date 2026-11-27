import { useCallback, useMemo } from "react";

import { type AidedDocument, useAidedDocument } from "@/data/document-reads";

import { type AidActions, useAidCommands } from "./aid-commands";
import { FoldsControl, useBlockFolds } from "./block-folds-part";
import { CountsLine } from "./counts-line";
import { moveToBlock } from "./moves";
import { OutlineNav, useOutline } from "./outline";
import { type BlockCounts, blockCounts } from "./outline-entries";
import type { PartsEntry, PartsProps } from "./parts-slot";
import { ReadFirst, useReadFirst } from "./read-first";
import { useMeasuredRender } from "./timing";
import { useBaseline } from "./use-baseline";
import { useChangeMarks } from "./use-change-marks";

function AidCommands({ actions }: { actions: AidActions }): null {
  useAidCommands(actions);
  return null;
}

/** With no document resolved, the outline counts nothing. */
const NO_COUNTS: ReadonlyMap<string, BlockCounts> = new Map();

/** The shown editor's outline, and its keys merged with the other parts' into one registration. */
function ShownAids({
  actions,
  counts,
  entry,
}: {
  actions: AidActions;
  counts: ReadonlyMap<string, BlockCounts>;
  entry: PartsEntry;
}) {
  const outline = useOutline(entry, counts);
  return (
    <>
      <AidCommands actions={{ ...actions, ...outline.actions }} />
      <OutlineNav outline={outline} />
    </>
  );
}

function DocumentParts({ document, entry, shown }: PartsProps & { document: AidedDocument }) {
  useMeasuredRender();
  const folds = useBlockFolds(entry, document.artifactId);
  const readFirst = useReadFirst(entry, document);
  const baseline = useBaseline(document);
  const marks = useChangeMarks(entry.editor.view, baseline.baseline);
  const moveToSection = useCallback(
    (blockId: string) => moveToBlock(entry, blockId, "click"),
    [entry]
  );
  const { decisions, step } = readFirst;
  const changes = marks?.state === "shown" ? marks.shown?.summary.byBlock : undefined;
  const counts = useMemo(() => blockCounts(changes, decisions), [changes, decisions]);
  return (
    <>
      <ReadFirst document={document} state={readFirst} />
      <CountsLine
        controls={folds.toggleFolds === undefined ? null : <FoldsControl />}
        marks={marks}
        moveTo={moveToSection}
        read={baseline}
      />
      {shown ? (
        <ShownAids
          actions={{
            ...folds,
            nextDecision: step && (() => step(1)),
            previousDecision: step && (() => step(-1)),
          }}
          counts={counts}
          entry={entry}
        />
      ) : null}
    </>
  );
}

/** The parts above the document's text, drawn into its parts root; the shown one holds the keys. */
export function AidParts(props: PartsProps) {
  const document = useAidedDocument(props.entry.documentRef);
  if (document !== undefined) return <DocumentParts {...props} document={document} />;
  return props.shown ? <ShownAids actions={{}} counts={NO_COUNTS} entry={props.entry} /> : null;
}
