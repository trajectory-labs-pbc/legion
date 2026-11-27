// For each route of the route map (src/app/routes.ts), the address the route test opens and a
// heading, a labelled region or a text that only that route's page shows. A route with no entry
// here fails route-marks.test.ts, and so does an entry for a route the map no longer has. Every
// route opens in both modes.
//
// The local mode seeds through upstream's api.ts and its fakes; the deployed mode seeds only
// `as: "agent"` with E2E_AGENT_TOKEN, and reads the signed-in person with the storage state's
// session. A mark is the same in both modes unless the row says otherwise. A list page's mark is
// its heading, which it draws whatever a deployed Dispatch holds.
//
// One row per route: what the local run seeds; what the deployed run seeds, and through which call
// (the same call when it says "the same"); and the mark the deployed run expects where it seeds
// nothing.
//
// - `/`, `/replies`, `/credentials/*`: an open ask; the same (`createAsk`), retracted at the end.
//   `/replies` lands on the Inbox's reply rows, and `/credentials/*` on the Inbox's own address.
// - `/answers`: an answered ask; none, and the page heading (an answer is a lasting record in the
//   person's name).
// - `/projects/:key`, `/projects/:key/issues`: a project and an issue; the same (`createProject`,
//   `createIssue`).
// - `/projects/:key/documents`, `/projects/:key/documents/:slug`: a document; the same
//   (`createProjectDocument`).
// - `/projects/:key/architecture`: a source in the fake GitHub; none, and the not-found page,
//   which a project with no source draws there once it has read the project's sources.
// - `/issues/:key/*`: an issue; the same (`createIssue`).
// - `/priorities`, `/priorities/:id`: a priority; the same (`createPriority`), ended at the end.
// - `/agents`: a live session in the fake Envoy; none, and the page heading.
// - `/agents/:sessionId/live`: that session; none, and the heading of a session with no title.
// - `/agents/:sessionId/artifacts/:slug`: a file in that session; the same (an upload to
//   `POST /api/v1/agents/{id}/artifacts`).
// - `/agents/broadcasts`: a broadcast to that session; none, and the page heading.
// - `/agents/broadcasts/:id`: that broadcast; none (a broadcast as a real person would message
//   live sessions), and the page's load failure for an id the run names.
// - `/machines`, `/machines/:machine`: the session's machine; none, and the page of a machine
//   with no session, which the page draws for any name.
// - `/credentials/machine`: none; none. The code form where the broker serves the device grant,
//   else the not-found page.
// - `/people/:login`: the signed-in person; the storage state's person.
// - `/delivery`, `/pipeline`, `/settings`: none; none, and the page heading.
// - `/*`: none; none, and the not-found page.
import type { Page } from "@playwright/test";

/** What `routes.e2e.ts` seeds; the records it could not seed in this mode are left out. */
export interface Seeded {
  /** The signed-in person's login. */
  person: string;
  project: string;
  projectName: string;
  issue: string;
  issueTitle: string;
  priority: string;
  document: string;
  documentName: string;
  session: string;
  artifact: string;
  artifactName: string;
  machine: string;
  /** Whether the server serves the machine login page, which needs its secrets broker. */
  machineLogin: boolean;
  /** A broadcast id no broadcast has. */
  missingBroadcast: string;
  missingPage: string;
  /** What only the local mode seeds: a broadcast to a live session (and an architecture source). */
  local?: { broadcast: string };
}

export type Mark =
  | {
      role: Parameters<Page["getByRole"]>[0];
      name: string | RegExp;
      /** A heading's level, 1 for a page's own title. */
      level?: number;
    }
  | { text: string };

export interface RouteMark {
  href: string;
  mark: Mark;
  /** A path the page reads, and must read with success, where the mark alone is not the
   *  route's own. */
  reads?: string;
  /** The address the page shows once its mark does: its path and, of its search, these
   *  parameters. */
  lands?: { pathname: string; search?: Readonly<Record<string, string>> };
  /** The id of a record the row expects not to find. Chromium's console error for a 404 to a
   *  request that names it is the mark's cause, and passes; any other error fails. */
  missing?: string;
}

const heading = (name: string | RegExp, level = 1): Mark => ({ level, name, role: "heading" });
const region = (name: string): Mark => ({ role: "region", name });
const NOT_FOUND = heading("Page not found");

/** Each route's mark, keyed by the route's path as the route map writes it. */
export function routeMarks(s: Seeded): Readonly<Record<string, RouteMark>> {
  const project = `/projects/${s.project}`;
  return {
    "/": { href: "/", mark: heading("Inbox") },
    "/answers": { href: "/answers", mark: heading("Answered by you") },
    // Redirects to the Inbox's reply rows.
    "/replies": {
      href: "/replies",
      mark: heading("Inbox"),
      lands: { pathname: "/", search: { type: "reply" } },
    },
    // An old address that draws the Inbox. Upstream's Inbox writes its own address, which
    // buildInboxPath puts on `/`, in place of this one as it loads.
    "/credentials/*": {
      href: "/credentials/request",
      mark: heading("Inbox"),
      lands: { pathname: "/" },
    },
    "/credentials/machine": {
      href: "/credentials/machine",
      mark: s.machineLogin ? heading("Enter machine login code") : NOT_FOUND,
    },
    "/agents": { href: "/agents", mark: heading("Agents") },
    "/agents/broadcasts": { href: "/agents/broadcasts", mark: heading("Broadcasts") },
    "/agents/broadcasts/:id": s.local
      ? { href: `/agents/broadcasts/${s.local.broadcast}`, mark: heading("Broadcast to 1 agent") }
      : {
          href: `/agents/broadcasts/${s.missingBroadcast}`,
          mark: { text: "Could not load this broadcast" },
          missing: s.missingBroadcast,
        },
    // The layout draws the live view, so this mark proves the layout's route. The heading names
    // the session after its state: by its title, else `session:` and its first 8 characters.
    "/agents/:sessionId/live": {
      href: `/agents/${s.session}/live`,
      mark: heading(new RegExp(`(^|\\s)(session:)?${s.session.slice(0, 8)}`)),
    },
    "/agents/:sessionId/artifacts/:slug": {
      href: `/agents/${s.session}/artifacts/${s.artifact}`,
      mark: region(`Versions for ${s.artifactName}`),
    },
    "/machines": { href: "/machines", mark: heading("Machines") },
    // The page draws any machine; the local mode puts the live session on this one.
    "/machines/:machine": { href: `/machines/${s.machine}`, mark: region(`Machine ${s.machine}`) },
    "/issues/:key/*": { href: `/issues/${s.issue}`, mark: heading(s.issueTitle) },
    "/priorities": { href: "/priorities", mark: heading("Priorities") },
    "/priorities/:id": {
      href: `/priorities/${s.priority}`,
      mark: region("Work advancing this priority"),
    },
    "/projects/:key": { href: project, mark: heading(s.projectName) },
    // A project with no architecture source draws the not-found page here, after it reads the
    // project's sources, which the catch-all route never reads. NotFoundPage's title wins over
    // the project's, so the title cannot tell them apart.
    "/projects/:key/architecture": {
      href: `${project}/architecture`,
      mark: s.local ? { role: "tabpanel", name: "Architecture" } : NOT_FOUND,
      reads: `/api/v1${project}/architecture-sources`,
    },
    "/projects/:key/issues": { href: `${project}/issues`, mark: region("Project issues") },
    "/projects/:key/documents": { href: `${project}/documents`, mark: region("Project documents") },
    "/projects/:key/documents/:slug": {
      href: `${project}/documents/${s.document}`,
      // The document's header draws its name at level 2.
      mark: heading(s.documentName, 2),
    },
    // Drawn once the person's nodes load.
    "/people/:login": { href: `/people/${s.person}`, mark: region("Person") },
    "/settings": { href: "/settings", mark: heading("Settings") },
    "/delivery": { href: "/delivery", mark: heading("Delivery timeline") },
    "/pipeline": { href: "/pipeline", mark: heading("Pipeline") },
    "/*": { href: s.missingPage, mark: NOT_FOUND },
  };
}
