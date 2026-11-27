// What the route test and the exit flows share: the run's records, reads as the signed-in person
// and as the agent, a write as the person, the person's session cookie, a write held in the
// browser, and a mark that tells a reload apart.
import type { Cookie, Page } from "@playwright/test";

import {
  baseUrl,
  createIssue,
  createProject,
  dashboardOrigin,
  e2eAgentToken,
  sessionCookie,
} from "../../dispatch/e2e/api";
import { pendingWrites } from "../../dispatch/e2e/keyed-writes";
import { type HeldPatches, holdIssuePatches } from "../../dispatch/e2e/pick-writes";
import type { Traffic } from "../../dispatch/e2e/traffic";
import { deployedSettings, storageCookies } from "./modes";
import { deployed, expect, runName } from "./test";

export const AGENT = { as: "agent" } as const;

/** How long the page has no request in flight before it counts as drawn. */
const QUIET_MS = 500;

/** Waits until the page has had no request in flight for `QUIET_MS`. */
export async function waitForQuiet(traffic: Traffic, message: string): Promise<void> {
  await expect.poll(() => traffic.quietFor(QUIET_MS), { intervals: [50], message }).toBe(true);
}

/** A read through this worker's fetch, which the deployed mode guards (test.ts). */
async function read<T>(path: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), { headers });
  if (!response.ok)
    throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

/** The page's session cookie, as a request header. */
async function sessionOf(page: Page): Promise<{ Cookie: string }> {
  const cookies = await page.context().cookies(baseUrl);
  return { Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join("; ") };
}

/** A read as the signed-in person. */
export async function readAsPerson<T>(page: Page, path: string): Promise<T> {
  return read(path, await sessionOf(page));
}

/** A PUT as the signed-in person, with the Origin a user's write carries in upstream's api.ts. */
export async function writeAsPerson(page: Page, path: string, body: object): Promise<void> {
  const response = await fetch(new URL(path, baseUrl), {
    body: JSON.stringify(body),
    headers: {
      ...(await sessionOf(page)),
      "Content-Type": "application/json",
      Origin: dashboardOrigin,
    },
    method: "PUT",
  });
  if (!response.ok)
    throw new Error(`PUT ${path} answered ${response.status}: ${await response.text()}`);
}

/** A read as the run's agent (`E2E_AGENT_TOKEN` in the deployed mode). */
export function readAsAgent<T>(path: string): Promise<T> {
  return read(path, { Authorization: `Bearer ${e2eAgentToken}` });
}

/** The login of the person `page` is signed in as. */
export async function personOf(page: Page): Promise<string> {
  return (await readAsPerson<{ login: string }>(page, "/auth/whoami")).login;
}

/** The run's one project, named after the run. A deployed Dispatch cannot delete a project, so
 *  every test of a run shares it: the first makes it, as the agent, with `login` its default
 *  assignee. A project with that key and another name is not the run's, and is refused. */
export async function runProject(login: string): Promise<{ key: string; name: string }> {
  const project = { key: runName, name: `${runName} run` };
  try {
    await createProject({ ...project, default_assignee: login }, AGENT);
  } catch (error) {
    if (!String(error).includes("PROJECT_EXISTS")) throw error;
    const projects = await readAsAgent<{ key: string; name: string }[]>("/api/v1/projects");
    const name = projects.find((existing) => existing.key === project.key)?.name;
    if (name !== project.name) {
      throw new Error(
        `Project ${project.key} exists as "${name}", not this run's: pick another E2E_RUN_NAME.`
      );
    }
  }
  return project;
}

/** The cookies that sign the person in, as a sign-in sets them: in the local mode alice's, from
 *  dev sign-in; in the deployed mode the storage state's. */
export async function personCookies(): Promise<Cookie[]> {
  return deployed
    ? storageCookies(deployedSettings().storageState)
    : [await sessionCookie("alice")];
}

/** The status `GET /auth/whoami` answers in `page`: 200 while it is signed in, 401 once not. */
export function whoamiStatus(page: Page): Promise<number> {
  return page.evaluate(async () => (await fetch("/auth/whoami")).status);
}

/** Marks the document `page` shows, so `sameDocument` tells whether it was loaded again since. */
export async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    Reflect.set(window, "__flowMark", true);
  });
}

export function sameDocument(page: Page): Promise<boolean> {
  return page.evaluate(() => Reflect.get(window, "__flowMark") === true);
}

/** A new issue in the run's project, titled after the run, and its key. A deployed Dispatch is
 *  never emptied, so there a title can repeat an earlier run's issue in the same project (each
 *  switch phase files the same one), which Dispatch refuses as a possible duplicate unless the
 *  request says `force`. A local database starts empty for each test, so there it never does. */
export async function runIssue(page: Page, title: string): Promise<string> {
  const project = await runProject(await personOf(page));
  const body = { project: project.key, title: `${runName} ${title}` };
  return (await createIssue(deployed ? { ...body, force: true } : body, AGENT)).key;
}

/** The status `heldStatusChange` sets. */
export const HELD_STATUS = "todo";

/** A status change of a new issue of the run, to HELD_STATUS, made on its page and held in the
 *  browser by upstream's `holdIssuePatches`: it shows in the pending-writes indicator and stays
 *  unsent until `held.release()`. A save still held when the page closes never leaves. */
export async function heldStatusChange(
  page: Page,
  title: string
): Promise<{ issue: string; held: HeldPatches }> {
  const issue = await runIssue(page, title);
  const held = await holdIssuePatches(page, issue);
  // A page with an unsent write asks before it unloads.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`/issues/${issue}`);
  await page.getByLabel("Status").selectOption(HELD_STATUS);
  await expect(pendingWrites(page)).toBeVisible();
  return { held, issue };
}
