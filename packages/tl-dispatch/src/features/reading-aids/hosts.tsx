import { useQueryClient } from "@tanstack/react-query";
import { loadDocumentTransport } from "@upstream-dispatch/features/doc/connection";
import {
  DocumentRuntime,
  type DocumentRuntimeValue,
} from "@upstream-dispatch/features/doc/runtime";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

import { createAidedEditor, HOST_ATTRIBUTE, loadHostAids } from "./aided-editor";
import { type PartsEntry, reportingSync, usePartsOf } from "./parts-slot";
import { recordReadMarks } from "./visit";

/** The runtime the host pages make their editors with: upstream's, with the aided editor. */
const AIDED_RUNTIME: DocumentRuntimeValue = {
  createEditor: createAidedEditor,
  loadTransport: async () => reportingSync(await loadDocumentTransport()),
};

/** The entry whose editor has a layout: the document the reader sees, of those the host mounts. */
function useShownEntry(entries: readonly PartsEntry[]): PartsEntry | undefined {
  const [shown, setShown] = useState<PartsEntry>();
  // Measured before the paint, so the parts draw in the first frame.
  useLayoutEffect(() => {
    const measure = () =>
      setShown(entries.find((entry) => entry.editor.view.dom.getClientRects().length > 0));
    const observer = new ResizeObserver(measure);
    for (const entry of entries) observer.observe(entry.editor.view.dom);
    measure();
    return () => observer.disconnect();
  }, [entries]);
  return shown !== undefined && entries.includes(shown) ? shown : undefined;
}

/** The element around a host page: it takes the focus after a move and holds the aids' runtime. */
export function ReadingAidsHost({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => recordReadMarks(queryClient), [queryClient]);
  // The aids load while the document's text and connection do, so its editor seldom waits.
  useEffect(() => {
    void loadHostAids();
  }, []);
  const entries = usePartsOf(host);
  const shown = useShownEntry(entries);
  return (
    <div className="outline-none" ref={setHost} {...{ [HOST_ATTRIBUTE]: "" }}>
      <DocumentRuntime.Provider value={AIDED_RUNTIME}>{children}</DocumentRuntime.Provider>
      {entries.map((entry) =>
        createPortal(<entry.Parts entry={entry} shown={entry === shown} />, entry.root, entry.key)
      )}
    </div>
  );
}
