import { type ReactNode, useEffect } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";

/** Filled, once the router mounts, with the move to another address, as a followed link does. */
export interface Move {
  to?: (path: string) => void;
}

/** A router held in memory at one address, in place of the app's `NavigationProvider`. */
export function MemoryNavigationProvider({
  path,
  children,
  move,
}: {
  path: string;
  children: ReactNode;
  move?: Move;
}) {
  return (
    <MemoryRouter initialEntries={[path]}>
      {move === undefined ? null : <Mover move={move} />}
      {children}
    </MemoryRouter>
  );
}

function Mover({ move }: { move: Move }) {
  const navigate = useNavigate();
  useEffect(() => {
    move.to = (path) => void navigate(path);
  }, [navigate, move]);
  return null;
}
