import { createRouteTree } from "@/navigation/route-tree";

import { agents } from "./agents";
import { credentials } from "./credentials";
import { delivery } from "./delivery";
import { projectDocument } from "./document";
import { inbox } from "./inbox";
import { issue } from "./issue";
import { machineLogin } from "./machine-login";
import { machines } from "./machines";
import { notFound } from "./not-found";
import type { Page, PageLayout } from "./page";
import { people } from "./people";
import { priorities } from "./priorities";
import { project } from "./project";
import { settings } from "./settings";

/** The route map: every page and the routes it serves. */
export const pages = [
  inbox,
  agents,
  machines,
  issue,
  priorities,
  project,
  projectDocument,
  credentials,
  machineLogin,
  settings,
  delivery,
  people,
  notFound,
] as const satisfies readonly Page[];

/** The pages' route tree: the outlet, and the page an address opens with its layout. */
export const { PageRoutes, pageAt, useCurrentPage } = createRouteTree<PageLayout, Page>(pages);
