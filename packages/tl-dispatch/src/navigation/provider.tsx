import type { ReactNode } from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

/** The app's router, on the browser's address. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

/** A router held in memory at one address, for tests. */
export function MemoryNavigationProvider({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
}
