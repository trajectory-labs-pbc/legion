import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useDocumentTitle } from "./upstream";

/** The page a Dispatch without the device grant shows at the machine login address. */
export function NotFound(): ReactNode {
  useDocumentTitle("Not found · Dispatch");
  return (
    <section className="max-w-2xl space-y-2">
      <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">That link doesn't match a page in Dispatch.</p>
      <Link
        className="mt-2 inline-flex min-h-11 items-center border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chart-5 md:min-h-9 dark:focus-visible:outline-ring"
        to="/"
      >
        Back to inbox
      </Link>
    </section>
  );
}
