// Opens each route of the route map (src/pages/index.ts) against records this run seeds, and
// fails on a route whose mark (route-marks.ts) does not show or that logs a console error.
import { randomUUID } from "node:crypto";

import { setLiveSessions } from "../../dispatch/e2e/agents";
import {
  answerAsk,
  baseUrl,
  createAsk,
  createBroadcast,
  createIssue,
  createPriority,
  createProject,
  createProjectDocument,
  e2eAgentToken,
  endPriority,
  putArchitectureSource,
  resolveAsk,
  syncArchitectureSource,
} from "../../dispatch/e2e/api";
import { seedFakeGithub } from "../../dispatch/e2e/fake-github-helpers";
import { watchTraffic } from "../../dispatch/e2e/traffic";
import { type Mark, routeMarks, type Seeded } from "./route-marks";
import { deployed, expect, type Page, runName, test } from "./test";

const AGENT = { as: "agent" } as const;

/** How long the page has no request in flight before an error it logs counts as logged. */
const QUIET_MS = 500;

/** What Chromium logs for a response of 404: on a not-found row, for its own id, that is the
 *  mark's cause. */
const NOT_FOUND_LOAD = "Failed to load resource: the server responded with a status of 404";

/** Undoes one record a seed made. */
type Cleanup = () => Promise<unknown>;

/** A read as the signed-in person, through this worker's fetch, which the deployed mode guards
 *  (test.ts). */
async function readAsPerson<T>(page: Page, path: string): Promise<T> {
  const cookies = await page.context().cookies(baseUrl);
  const Cookie = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  const response = await fetch(new URL(path, baseUrl), { headers: { Cookie } });
  if (!response.ok)
    throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

/** A file in a session's conversation; the API's helpers have no upload as an agent. */
async function uploadSessionFile(session: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("name", name);
  form.append("actor", JSON.stringify({ kind: "session", id: session }));
  form.append("file", new Blob(["route test\n"], { type: "text/plain" }), name);
  const response = await fetch(new URL(`/api/v1/agents/${session}/artifacts`, baseUrl), {
    body: form,
    headers: { Authorization: `Bearer ${e2eAgentToken}` },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`upload to ${session} failed: ${response.status} ${await response.text()}`);
  }
  const { artifact } = (await response.json()) as { artifact: { slug: string } };
  return artifact.slug;
}

/** The records the routes open, each named after the run. Each record a run must undo is
 *  undone by a cleanup `seed` adds as soon as the record exists. */
async function seed(page: Page, cleanups: Cleanup[]): Promise<Seeded> {
  const { login } = await readAsPerson<{ login: string }>(page, "/auth/whoami");
  const { machine_code_page: machineLogin } = await readAsPerson<{ machine_code_page: boolean }>(
    page,
    "/api/v1/credentials/capabilities"
  );
  const run = runName.toLowerCase();
  const projectName = `${runName} routes`;
  await createProject({ key: runName, name: projectName, default_assignee: login }, AGENT);
  const issueTitle = `${runName} route issue`;
  const issue = await createIssue({ project: runName, title: issueTitle }, AGENT);
  const options = [{ label: "Ship" }];
  // An open ask of the signed-in person, in their Inbox until the run ends.
  const ask = await createAsk(issue.key, { options, question: `${runName} open ask?` }, AGENT);
  cleanups.push(() => resolveAsk(ask.id, { kind: "retracted", reason: "The run ended." }, AGENT));
  const priority = await createPriority(
    { owner: login, title: `${runName} route priority` },
    AGENT
  );
  // Otherwise it stays on every person's list.
  cleanups.push(() => endPriority(priority.id, AGENT));
  const documentName = `${runName} route document`;
  const document = await createProjectDocument(
    runName,
    { content: "Opened by the route test.\n", name: documentName },
    AGENT
  );
  // Dispatch's agent routes take a session id that is a UUID; the file's name carries the run's.
  const session = randomUUID();
  const artifactName = `${run}-notes.txt`;
  const seeded: Seeded = {
    person: login,
    project: runName,
    projectName,
    issue: issue.key,
    issueTitle,
    priority: priority.id,
    document: document.artifact.slug,
    documentName,
    session,
    artifact: await uploadSessionFile(session, artifactName),
    artifactName,
    machine: `machine-${run}`,
    machineLogin,
    missingBroadcast: randomUUID(),
    missingPage: `/${run}-no-such-page`,
  };
  // The deployed mode stops here. An answer is a lasting record in the person's name, and a
  // broadcast as a real person would message the live sessions it names.
  if (deployed) return seeded;
  const answered = await createAsk(issue.key, { options, question: `${runName} answer?` }, AGENT);
  await answerAsk(answered.id, { expected_edited_at: null, selected: ["Ship"] }, { login });
  // The local harness's fakes: a live session and a repository its GitHub App reads.
  await setLiveSessions([
    { capabilities: ["aside"], machine_id: seeded.machine, session_id: session, title: session },
  ]);
  const broadcast = await createBroadcast({
    body: "route test",
    delivery: "aside",
    session_ids: [session],
  });
  const repo = "legion/routes";
  const files = { "platform.md": "---\ntitle: Platform\n---\nEverything that runs.\n" };
  await seedFakeGithub({ [repo]: { contents: "read", files, installation_id: 101 } });
  await putArchitectureSource(runName, { branch: "main", repo });
  await syncArchitectureSource(runName, repo);
  return { ...seeded, local: { broadcast: broadcast.id } };
}

test("each route of the route map opens its page, with no console error", async ({ page }) => {
  test.setTimeout(300_000);
  const cleanups: Cleanup[] = [];
  try {
    await openEachRoute(page, routeMarks(await seed(page, cleanups)));
  } finally {
    // Each on its own, so one that fails leaves none of the others undone.
    const results = await Promise.allSettled(cleanups.map((cleanup) => cleanup()));
    const failed = results.flatMap((result) =>
      result.status === "rejected" ? [String(result.reason)] : []
    );
    expect.soft(failed, "cleanups that failed").toEqual([]);
  }
});

function locate(page: Page, mark: Mark) {
  if ("text" in mark) return page.getByText(mark.text);
  const { role, ...options } = mark;
  return page.getByRole(role, { ...options, exact: true });
}

interface Logged {
  text: string;
  /** The URL of what logged it: for a failed load, the resource's. */
  url: string;
}

async function openEachRoute(page: Page, marks: ReturnType<typeof routeMarks>): Promise<void> {
  // route-marks.test.ts holds these paths to the route map's.
  const paths = Object.keys(marks);

  // The errors of the route open now.
  let errors: Logged[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push({ text: message.text(), url: message.location().url });
    }
  });
  page.on("pageerror", (error) => errors.push({ text: error.message, url: "" }));
  // The paths the route read with success.
  let read: string[] = [];
  page.on("response", (response) => {
    if (response.ok()) read.push(new URL(response.url()).pathname);
  });
  const traffic = watchTraffic(page);

  for (const path of paths) {
    const entry = marks[path];
    await test.step(path, async () => {
      errors = [];
      read = [];
      await page.goto(entry.href);
      await expect.soft(locate(page, entry.mark).first(), `${path}: its mark`).toBeVisible();
      await expect
        .poll(() => traffic.quietFor(QUIET_MS), {
          intervals: [50],
          message: `${path}: the page's requests settle`,
        })
        .toBe(true);
      if (entry.lands !== undefined) {
        const url = new URL(page.url());
        expect
          .soft(
            { pathname: url.pathname, search: Object.fromEntries(url.searchParams) },
            `${path}: the address it lands on`
          )
          .toMatchObject({ search: {}, ...entry.lands });
      }
      if (entry.reads !== undefined) {
        expect.soft(read, `${path}: its successful reads`).toContain(entry.reads);
      }
      const { missing } = entry;
      const own = (error: Logged) =>
        missing !== undefined &&
        error.text.startsWith(NOT_FOUND_LOAD) &&
        error.url.includes(missing);
      expect
        .soft(
          errors.filter((error) => !own(error)).map((error) => error.text),
          `${path} (${entry.href}): console errors`
        )
        .toEqual([]);
    });
  }
}
