import { type AidActions, useAidCommands } from "./aid-commands";
import { CountsLine } from "./counts-line";
import type { PartsProps } from "./parts-slot";
import { ReadFirst, useReadFirst } from "./read-first";
import { type AidedDocument, useAidedDocument } from "./reads";
import { useBaseline } from "./use-baseline";

function AidCommands({ actions }: { actions: AidActions }): null {
  useAidCommands(actions);
  return null;
}

function DocumentParts({ document, entry, shown }: PartsProps & { document: AidedDocument }) {
  const readFirst = useReadFirst(entry, document);
  const baseline = useBaseline(document);
  const { step } = readFirst;
  return (
    <>
      <ReadFirst document={document} state={readFirst} />
      <CountsLine read={baseline} />
      {shown ? (
        <AidCommands
          actions={{
            nextDecision: step && (() => step(1)),
            previousDecision: step && (() => step(-1)),
          }}
        />
      ) : null}
    </>
  );
}

/** The parts above the document's text, drawn into its parts root; the shown one holds the keys. */
export function AidParts(props: PartsProps) {
  const document = useAidedDocument(props.entry.documentRef);
  if (document !== undefined) return <DocumentParts {...props} document={document} />;
  return props.shown ? <AidCommands actions={{}} /> : null;
}
