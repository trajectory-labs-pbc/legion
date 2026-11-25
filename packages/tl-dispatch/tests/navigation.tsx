import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

/** A router held in memory at one address, in place of the app's `NavigationProvider`. */
export function MemoryNavigationProvider({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}
