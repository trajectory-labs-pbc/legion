import { type ReactNode, useEffect } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";

/** Takes the function that moves the address, as a followed link does. */
export type TakeMove = (move: (path: string) => void) => void;

/** A router held in memory at one address, in place of the app's `NavigationProvider`. */
export function MemoryNavigationProvider({
  path,
  children,
  takeMove,
}: {
  path: string;
  children: ReactNode;
  takeMove?: TakeMove;
}) {
  return (
    <MemoryRouter initialEntries={[path]}>
      {takeMove === undefined ? null : <Mover takeMove={takeMove} />}
      {children}
    </MemoryRouter>
  );
}

function Mover({ takeMove }: { takeMove: TakeMove }) {
  const navigate = useNavigate();
  useEffect(() => takeMove((path) => void navigate(path)), [navigate, takeMove]);
  return null;
}
