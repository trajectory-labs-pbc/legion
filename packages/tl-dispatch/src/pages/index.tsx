import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

import { agents } from "./agents";
import { credentials } from "./credentials";
import { delivery } from "./delivery";
import { projectDocument } from "./document";
import { inbox } from "./inbox";
import { issue } from "./issue";
import { machines } from "./machines";
import { notFound } from "./not-found";
import type { Page } from "./page";
import { priorities } from "./priorities";
import { project } from "./project";
import { refs } from "./refs";
import { settings } from "./settings";

/** The route map: every page and the routes it serves. */
export const pages: readonly Page[] = [
  inbox,
  agents,
  machines,
  issue,
  priorities,
  project,
  projectDocument,
  credentials,
  settings,
  delivery,
  refs,
  notFound,
];

export function AppRoutes(): ReactNode {
  return (
    <Routes>
      {pages.flatMap((page) =>
        page.routes.map((route) => (
          <Route element={route.element} key={route.path} path={route.path} />
        ))
      )}
    </Routes>
  );
}
