import type { ReactNode } from "react";
import { ReadingAidsHost } from "@/parts/reading-aids";
import { DocumentPage as UpstreamDocumentPage } from "@/upstream/views/document";

/** Upstream's project document page, with the reading aids on its document. */
export function DocumentPage(): ReactNode {
  return (
    <ReadingAidsHost>
      <UpstreamDocumentPage />
    </ReadingAidsHost>
  );
}
