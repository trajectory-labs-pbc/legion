import { IssuePage } from "@upstream-dispatch/features/issue-page/IssuePage";
import type { ReactNode } from "react";

import { ReadingAidsHost } from "./hosts";

/** Upstream's issue page, with the aids on its documents. */
export function AidedIssuePage(): ReactNode {
  return (
    <ReadingAidsHost>
      <IssuePage />
    </ReadingAidsHost>
  );
}
