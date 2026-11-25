import { useDocumentTitle } from "@upstream-dispatch/features/shell/useDocumentTitle";
import type { ReactNode } from "react";

import { PageLink } from "@/navigation/page-link";
import { Button } from "@/ui/button";
import { SurfaceTitle } from "@/ui/heading";
import { inbox } from "../inbox";

/** Shown at an address that opens no page, and at a page this Dispatch does not serve. */
export function NotFound(): ReactNode {
  useDocumentTitle("Not found · Dispatch");
  return (
    <section className="max-w-2xl space-y-2">
      <SurfaceTitle size="page">Page not found</SurfaceTitle>
      <p className="text-sm text-muted-foreground">That link doesn't match a page in Dispatch.</p>
      <Button className="mt-2" render={<PageLink page={inbox.routes.home} />}>
        Back to inbox
      </Button>
    </section>
  );
}
