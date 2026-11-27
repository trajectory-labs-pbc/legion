import { useCallback } from "react";

import { type AidActions, useAidCommands } from "./aid-commands";
import { FoldsControl, useBlockFolds } from "./block-folds-part";
import { CountsLine } from "./counts-line";
import { moveToBlock } from "./moves";
import type { PartsProps } from "./parts-slot";
import { ReadFirst, useReadFirst } from "./read-first";
import { type AidedDocument, useAidedDocument } from "./reads";
import { useMeasuredRender } from "./timing";
import { useBaseline } from "./use-baseline";
import { useChangeMarks } from "./use-change-marks";

function AidCommands({ actions }: { actions: AidActions }): null {
  useAidCommands(actions);
  return null;
}

function DocumentParts({
  document,
  entry,
  folds,
  shown,
}: PartsProps & { document: AidedDocument; folds: AidActions }) {
  useMeasuredRender();
  const readFirst = useReadFirst(entry, document);
  const baseline = useBaseline(document);
  const marks = useChangeMarks(entry.editor.view, baseline.baseline);
  const moveToSection = useCallback(
    (blockId: string) => moveToBlock(entry, blockId, "click"),
    [entry]
  );
  const { step } = readFirst;
  return (
    <>
      <ReadFirst document={document} state={readFirst} />
      <CountsLine marks={marks} moveTo={moveToSection} read={baseline} />
      {shown ? (
        <AidCommands
          actions={{
            ...folds,
            nextDecision: step && (() => step(1)),
            previousDecision: step && (() => step(-1)),
          }}
        />
      ) : null}
      {folds.toggleFolds === undefined ? null : <FoldsControl />}
    </>
  );
}

/** The parts above the document's text, drawn into its parts root; the shown one holds the keys. */
export function AidParts(props: PartsProps) {
  const document = useAidedDocument(props.entry.documentRef);
  const folds = useBlockFolds(props.entry);
  if (document !== undefined) return <DocumentParts {...props} document={document} folds={folds} />;
  return (
    <>
      {props.shown ? <AidCommands actions={folds} /> : null}
      {folds.toggleFolds === undefined ? null : <FoldsControl />}
    </>
  );
}
