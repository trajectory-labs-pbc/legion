import { DocumentPage } from "@upstream-dispatch/features/document/DocumentPage";
import type { ReactNode } from "react";

import { ReadingAidsHost } from "./hosts";

/** Upstream's project document page, with the aids on its document. */
export function AidedDocumentPage(): ReactNode {
  return (
    <ReadingAidsHost>
      <DocumentPage />
    </ReadingAidsHost>
  );
}
