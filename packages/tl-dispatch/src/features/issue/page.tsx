import type { ReactNode } from "react";
import { ReadingAidsHost } from "@/parts/reading-aids";
import { IssuePage as UpstreamIssuePage } from "@/upstream/views/issue";

/** Upstream's issue page, with the reading aids on its documents. */
export function IssuePage(): ReactNode {
  return (
    <ReadingAidsHost>
      <UpstreamIssuePage />
    </ReadingAidsHost>
  );
}
