import { Button } from "@legion/ui/components/button";
import { SurfaceTitle } from "@legion/ui/components/heading";
import type { ReactNode } from "react";
import { PageLink } from "@/navigation/page-link";
import { inbox } from "../inbox";
import { useDocumentTitle } from "./upstream";

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
