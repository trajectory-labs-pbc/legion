import { createContext, type ReactNode, useContext } from "react";

// Inside a sheet, dialog or drawer a menu or popover defaults to modal, so a press outside it
// closes only that popup and not the surface below.
const ModalSurfaceContext = createContext(false);

export function ModalSurfaceProvider({ children }: { children: ReactNode }) {
  return <ModalSurfaceContext.Provider value={true}>{children}</ModalSurfaceContext.Provider>;
}

export function useIsInsideModalSurface(): boolean {
  return useContext(ModalSurfaceContext);
}
