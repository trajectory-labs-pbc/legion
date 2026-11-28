import type { InboxListAddress } from "@/data/inbox/list";
import {
  AGENT_ARTIFACT_PATH,
  AGENT_LIVE_PATH,
  ANSWERS_PATH,
  PERSON_PATH,
  parseInboxSearch,
} from "@/upstream/routes";

import { routePath } from "./page-route";

export type { RoutePath } from "./page-route";

/**
 * The Inbox's address as the new Inbox reads it: upstream's reading, except that no `?group=` is
 * the "Needs you" grouping and `?group=priority` is upstream's Priority bands (R3).
 */
export function inboxAddress(search: string): InboxListAddress {
  const { group, ...route } = parseInboxSearch(search);
  const named = new URLSearchParams(search).get("group");
  return { ...route, group: named === "priority" ? "priority" : (group ?? "needs-you") };
}

/**
 * The addresses of each page, by its id and the name of the route. A link names one, so the shell
 * and a feature link to a page without an import of its route file, which puts each on its route.
 */
export const routes = {
  inbox: {
    // The key the old Replies address sets; the Inbox reads its other keys itself.
    home: routePath({ path: "/", search: ["type"] }),
    answers: routePath({ path: ANSWERS_PATH }),
    replies: routePath({ path: "/replies" }),
    // An old address upstream keeps: it draws the Inbox, which reads nothing from it.
    credentials: routePath({ path: "/credentials/*" }),
  },
  agents: {
    list: routePath({ path: "/agents" }),
    broadcasts: routePath({ path: "/agents/broadcasts" }),
    broadcast: routePath({ path: "/agents/broadcasts/:id" }),
    live: routePath({ path: AGENT_LIVE_PATH }),
    artifact: routePath({ path: AGENT_ARTIFACT_PATH }),
  },
  machines: {
    list: routePath({ path: "/machines" }),
    machine: routePath({ path: "/machines/:machine" }),
  },
  issue: {
    issue: routePath({ path: "/issues/:key/*" }),
  },
  priorities: {
    list: routePath({ path: "/priorities" }),
    priority: routePath({ path: "/priorities/:id" }),
  },
  project: {
    overview: routePath({ path: "/projects/:key" }),
    architecture: routePath({ path: "/projects/:key/architecture" }),
    issues: routePath({ path: "/projects/:key/issues" }),
    documents: routePath({ path: "/projects/:key/documents" }),
  },
  document: {
    document: routePath({ path: "/projects/:key/documents/:slug" }),
  },
  people: {
    person: routePath({ path: PERSON_PATH }),
  },
  settings: {
    settings: routePath({ path: "/settings" }),
  },
  delivery: {
    delivery: routePath({ path: "/delivery" }),
    pipeline: routePath({ path: "/pipeline" }),
  },
  "machine-login": {
    machine: routePath({ path: "/credentials/machine" }),
  },
  "not-found": {
    any: routePath({ path: "/*" }),
  },
} as const;
