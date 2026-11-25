import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

/** The app's router, on the browser's address. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>;
}
