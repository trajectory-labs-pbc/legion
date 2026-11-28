import type { ReactNode } from "react";
import { NotFound } from "./not-found";

/**
 * The page at an address no route opens. It draws the view the machine login page also draws,
 * and has code of its own so the build keeps it as a module the entry check can see.
 */
export function NotFoundPage(): ReactNode {
  return <NotFound />;
}
