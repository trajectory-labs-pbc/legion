// A change between the two apps keeps the person's state. In one app the person is signed in,
// types a draft, makes a write that stays unsent and hides the sidebar; on the other app the
// sign-in, the draft, the write and the hidden sidebar are still there. The draft is the issue
// page's comment, which upstream's draft store keeps in the tab's sessionStorage; the write is a
// status change held in the browser (page.route), an `indicator` write that upstream's write store
// keeps in sessionStorage; the preference is the sidebar (`shell.sidebar`, in localStorage), which
// both apps read; the sign-in is the session cookie.
//
// Local mode (`bun run test:browser:switch`): upstream's two-process mode serves this app from
// Dispatch A and upstream's build from Dispatch B (DISPATCH_E2E_WEB_DIST_B), under one origin, so
// both builds see the same storage. The test switches the app by moving the proxy's
// `dispatch-e2e-page` cookie, which picks the build a page loads, and reloading the tab, not by
// restarting the server. The reload comes within upstream's resume window (KEPT_SEND_RESUME_MS),
// so the other app sends the write again and lists it as pending; the test then lets it go.
//
// Deployed mode (E2E_PHASE `switch-to-upstream` or `switch-to-new`): the switch is a deploy, in
// one tab. The test writes, prints `waiting for <file>`, then waits in the same tab for the file
// E2E_SWITCH_SIGNAL names, which the operator writes once the deploy has finished, and for the
// builds answer to name one new build on three reads 10 s apart; then it reloads and reads. It reloads more than KEPT_SEND_RESUME_MS after the press, so
// the other app lists the write as kept but interrupted, with Retry and Discard. The test presses
// neither, and the hold keeps the write from ever reaching Dispatch.
import { existsSync } from "node:fs";

import { getIssue } from "../../dispatch/e2e/api";
import { composer } from "../../dispatch/e2e/editor";
import {
  type DispatchProcess,
  entryChunkOf,
  pagePinCookie,
} from "../../dispatch/e2e/harness-processes";
import { pendingWrites } from "../../dispatch/e2e/keyed-writes";
import { signIn } from "../../dispatch/e2e/users";
import { KEPT_SEND_RESUME_MS } from "../../dispatch/web/src/features/writes/write-storage";
import { type App, WEB_DISTS } from "./dists";
import { AGENT, HELD_STATUS, heldStatusChange, readAsAgent, whoamiStatus } from "./flows";
import { deployedSettings, type SwitchPhase } from "./modes";
import { deployed, expect, type Page, runName, test } from "./test";

/** The app each switch writes in, and the app it reads in. */
const DIRECTIONS: Readonly<Record<SwitchPhase, readonly [App, App]>> = {
  "switch-to-upstream": ["tl-dispatch", "upstream"],
  "switch-to-new": ["upstream", "tl-dispatch"],
};

/** The process that serves each app in the local mode. */
const PROCESS: Readonly<Record<App, DispatchProcess>> = { "tl-dispatch": "a", upstream: "b" };

/** The longest deploy the deployed mode waits for. */
const DEPLOY_MS = 60 * 60_000;
/** How long after the press the deployed mode reloads: past the resume window, whose rule is
 *  `now - pressedAt <= KEPT_SEND_RESUME_MS`. */
const KEPT_MS = KEPT_SEND_RESUME_MS + 15_000;
/** Reads of the builds answer that must agree, and the time between two of them. */
const BUILD_READS = 3;
const BUILD_READ_MS = 10_000;
/** How long the builds answer may take to name one new build after the signal. */
const BUILDS_MS = 10 * 60_000;

const DRAFT = `${runName} switch draft`;

const signInLink = (page: Page) => page.getByRole("link", { name: "Sign in with Google" });
const commentField = (page: Page) => composer(page).getByRole("textbox", { name: "Comment" });
const showSidebar = (page: Page) => page.getByRole("button", { name: "Show sidebar" });

/** The entry chunk of the build `page` loaded, as the builds answer names one. */
async function loadedEntry(page: Page): Promise<string> {
  const entry = await page
    .locator('script[type="module"][src^="/assets/index-"]')
    .getAttribute("src");
  if (entry === null) throw new Error("the page names no entry chunk");
  return entry;
}

/** Which app `page` draws, told by the sidebar's account control: this app's is a menu button,
 *  upstream's a plain Sign out button. The sidebar must be shown. */
async function shownApp(page: Page): Promise<App> {
  const menu = page.getByRole("button", { name: /^Signed in as / });
  const signOut = page.getByRole("button", { exact: true, name: "Sign out" });
  await expect(menu.or(signOut).first()).toBeVisible();
  return (await menu.count()) > 0 ? "tl-dispatch" : "upstream";
}

/** In app `from`, signed in on `page`: a held status change of a new issue, a draft comment in
 *  that issue's Conversation, and the sidebar hidden. */
async function write(page: Page, from: App) {
  const { held, issue } = await heldStatusChange(page, "switch");
  const pressedAt = Date.now();
  expect(await shownApp(page), "the app written in").toBe(from);
  await page.getByRole("tab", { name: "Conversation" }).click();
  await commentField(page).fill(DRAFT);
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await expect(showSidebar(page)).toBeVisible();
  return { held, issue, pressedAt };
}

/** In app `to`, which `page` now shows: the person is still signed in, and the draft and the
 *  hidden sidebar are still there. Shows the sidebar again to tell the app. */
async function readSignInDraftAndPreference(page: Page, to: App): Promise<void> {
  await expect(showSidebar(page), "the preference").toBeVisible();
  await expect(signInLink(page)).toHaveCount(0);
  expect(await whoamiStatus(page), "the sign-in").toBe(200);
  await expect(commentField(page), "the draft").toHaveValue(DRAFT);
  await showSidebar(page).click();
  expect(await shownApp(page), "the app read in").toBe(to);
}

for (const [name, [from, to]] of Object.entries(DIRECTIONS)) {
  test(`${name}: a change from ${from} to ${to} keeps the sign-in, a draft, an unsent write and a preference`, async ({
    emptyContext: context,
    baseURL,
  }) => {
    test.skip(deployed, "the deployed mode switches by a deploy, in its own phases");
    const pin = (app: App) =>
      context.addCookies([{ name: pagePinCookie, url: baseURL, value: PROCESS[app] }]);
    await pin(from);
    const page = await context.newPage();
    await page.goto("/");
    await expect(signInLink(page)).toBeVisible();
    expect(await loadedEntry(page)).toBe(entryChunkOf(WEB_DISTS[from]));
    // The local server's sign-in stands for the person's: it sets the session cookie.
    await signIn(context, "alice");
    const { held, issue } = await write(page, from);

    await pin(to);
    await page.reload();
    expect(await loadedEntry(page)).toBe(entryChunkOf(WEB_DISTS[to]));
    await readSignInDraftAndPreference(page, to);
    // The other app sent the write again, into the hold: it is pending, not refused.
    await expect(pendingWrites(page), "the unsent write").toContainText("1 change");
    await expect(pendingWrites(page).getByRole("button", { name: "Retry" })).toHaveCount(0);
    held.release();
    await expect(pendingWrites(page)).toHaveCount(0);
    expect(await getIssue(issue, AGENT)).toMatchObject({ status: HELD_STATUS });
  });
}

/** The builds answer: the entry chunk the answering process serves, and those every live process
 *  serves. */
const builds = () => readAsAgent<{ serving: string; live: string[] }>("/api/v1/dashboard/builds");

/** The one build every live process serves once the deploy has finished: the builds answer names
 *  exactly one, other than `serving`, on BUILD_READS reads in a row. While a rolling deploy runs,
 *  both builds are live. */
async function newBuild(serving: string): Promise<string> {
  const deadline = Date.now() + BUILDS_MS;
  let last: string | undefined;
  let streak = 0;
  for (;;) {
    const { live } = await builds();
    const entry = live.length === 1 && live[0] !== serving ? live[0] : undefined;
    streak = entry === undefined ? 0 : entry === last ? streak + 1 : 1;
    last = entry;
    if (entry !== undefined && streak === BUILD_READS) return entry;
    if (Date.now() > deadline) {
      throw new Error(`the builds answer named no one new build: live is ${JSON.stringify(live)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, BUILD_READ_MS));
  }
}

test("the deployed switch keeps the sign-in, a draft, an unsent write and a preference", async ({
  page,
}) => {
  test.skip(!deployed, "the local mode switches by the page cookie, in the tests above");
  const settings = deployedSettings();
  // PHASES runs this file in a switch phase only.
  if (settings.phase === "routes-and-flows") return test.skip(true, "not a switch phase");
  const { phase, switchSignal } = settings;
  const [from, to] = DIRECTIONS[phase];
  // The deploy wait outlasts KEPT_MS, so it bounds the wait before the reload.
  test.setTimeout(DEPLOY_MS + BUILDS_MS + 5 * 60_000);
  // A file left from an earlier run would end the wait before the deploy.
  expect(existsSync(switchSignal), `${switchSignal} exists before the run writes`).toBe(false);
  // No deploy is under way: every live process serves one build.
  const { live: before, serving } = await builds();
  expect(before, "the live builds at the start").toEqual([serving]);
  const { issue, pressedAt } = await write(page, from);
  expect(await loadedEntry(page), "the tab wrote in the build serving at the start").toBe(serving);

  // The operator's script watches for this line, then deploys and writes the file.
  console.log(`waiting for ${switchSignal}`);
  await expect
    .poll(() => existsSync(switchSignal), { intervals: [5_000], timeout: DEPLOY_MS })
    .toBe(true);
  await page.waitForTimeout(Math.max(0, pressedAt + KEPT_MS - Date.now()));
  const live = await newBuild(serving);
  await page.reload();
  expect(await loadedEntry(page), "the tab runs the deployed build").toBe(live);

  await readSignInDraftAndPreference(page, to);
  const indicator = pendingWrites(page);
  await expect(indicator, "the unsent write, kept").toContainText(
    `Not saved: ${issue} set to ${HELD_STATUS} — this page was closed before Dispatch confirmed it`
  );
  await expect(indicator.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(indicator.getByRole("button", { name: "Discard" })).toBeVisible();
});
