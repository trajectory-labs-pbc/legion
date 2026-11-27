// The axe run: each region the fork draws, in light and in dark, read by axe at WCAG 2.0 and 2.1
// level A and AA, the tags upstream's accessibility.e2e.ts reads its pages at. A row fails on any
// serious or critical finding, and accepts none. Each scan leaves out what upstream draws inside
// the region: each component of the seam draws inside a `data-upstream-view` mark, and upstream's
// own axe run reads those. Fork elements passed into a marked component sit in a
// `data-fork-view` mark inside it, which the scan reads again. The run seeds, so it is local
// only: the deployed mode leaves this file out (modes.ts).
//
// Beside it, with the same scope: a Tab walk over each region, in light and in dark, that goes
// round the page back to its first stop and finds FO1's outline at every stop in the region; and
// six pages the fork draws, at 390, 768 and 1440 px, with nothing that scrolls sideways (FR4).
import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";

import { createAsk } from "../../dispatch/e2e/api";
import type { FakeLauncherCredential } from "../../dispatch/e2e/fake-broker";
import { setLauncherCredentials, setMachineLogins } from "../../dispatch/e2e/fake-broker-helpers";
import { withIssuePage } from "../../dispatch/e2e/issue-page-option";
import { watchTraffic } from "../../dispatch/e2e/traffic";
import type { RecordResponse } from "../../dispatch/web/src/api/types";
import { AGENT, heldStatusChange, runIssue, waitForQuiet } from "./flows";
import { SIGN_OUT } from "./modes";
import { expect, type Page, runName, test } from "./test";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];
const PHONE = { width: 390, height: 844 };
/** The widths a page must fit with nothing scrolling sideways: a phone, a tablet and a desktop. */
const WIDTHS = [PHONE, { width: 768, height: 1024 }, { width: 1440, height: 900 }] as const;
/** More Tab presses than any region's walk takes to come back to its first stop. A walk that
 *  passes nothing twice but never comes back fails here. */
const MAX_TAB_PRESSES = 200;
const ASK = `${runName} ask?`;
const MACHINE_CODE = "WXYZ-4321";
/** Upstream's `LIVE_SOCKET_STUCK_MS`: how long a live socket reconnects before the page says live
 *  updates are not reaching it. */
const LIVE_SOCKET_STUCK_MS = 120_000;

const ROOT = "#root";
const SHELL = '[data-testid="app-shell"]';
const MAIN = '[data-testid="main-content"]';
const SIDEBAR = '[data-testid="sidebar"]';
const STATUS_CORNER = 'div:has(> [data-testid="connection-status"])';
const UPSTREAM_VIEW = "[data-upstream-view]";
const FORK_VIEW = "[data-fork-view]";
const TOOLTIP = '[data-slot="tooltip-content"]';

interface Region {
  name: string;
  /** The path to open, or how to make the record it names. */
  href: string | ((page: Page) => Promise<string>);
  /** The region's element: axe reads only inside it, and the Tab walk counts only the stops in
   *  it. */
  selector: string;
  /** What each check leaves out of the region beside upstream's widgets: a region another row
   *  reads, or an upstream page. axe and the Tab walk skip it, and the width check hides it. */
  exclude?: readonly string[];
  viewport?: { width: number; height: number };
  /** Runs before the page opens: the records it draws, and any request it must not send. */
  prepare?: (page: Page) => Promise<void>;
  /** What shows once the page is drawn. */
  ready: (page: Page) => Locator[];
  /** False where a request is held unanswered, so the page never goes quiet. */
  settles?: false;
  /** Opens the region once the page is drawn, and waits until it shows. */
  open?: (page: Page) => Promise<void>;
  /** What the region must draw in each scheme, checked before that scheme's scan and walk. */
  drawn?: (page: Page) => Promise<void>;
  /** "none" where the region holds no control, so the walk must find no stop in it. "skip" where
   *  it is not walked: a menu, which the arrow keys move in and Tab leaves, or a tooltip, which
   *  shows on hover. */
  tabStops?: "none" | "skip";
}

/** A serious or critical axe finding. */
interface Finding {
  rule: string;
  impact: string;
  scheme: Scheme;
  selector: string;
}

/** An open ask of the person's, so the Inbox and its counts draw a row and not an empty state. */
async function seedAsk(page: Page): Promise<void> {
  const issue = await runIssue(page, "axe issue");
  await createAsk(issue, { options: [{ label: "Ship" }], question: ASK }, AGENT);
}

/** A machine login pending on alice, whom upstream's `test` signs in, which a typed code looks
 *  up. */
async function seedMachineLogin(): Promise<void> {
  const record: RecordResponse = {
    approver: "alice",
    decided: null,
    enrollment: null,
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    identifiers: ["worker-7.example.com"],
    kind: "launcher_credential",
    lifetime_seconds: 900,
    reason: "",
    record_id: "record-machine-login",
    requested_at: "2026-09-27T00:00:00Z",
    rules_version: "v3",
    session: { enrollment: null, request: null },
    service: null,
    state: "pending",
  };
  await setMachineLogins([{ code: MACHINE_CODE, record }]);
}

/** A live machine login of alice's, so the page lists it with its Revoke. */
async function seedListedLogin(): Promise<void> {
  const login: FakeLauncherCredential = {
    approved_by: "alice",
    credential_id: "cred-worker-7",
    expired: false,
    expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    host: "worker-7.example.com",
    issued_at: new Date().toISOString(),
    listedFor: "alice",
    person: null,
    service: null,
    subject: null,
  };
  await setLauncherCredentials([login]);
}

/** Holds every request to `url` unanswered. */
const hold = (url: string | RegExp) => async (page: Page) => {
  await page.route(url, () => undefined);
};
/** A page view's chunk, named for its seam file: `views/issue.tsx` builds `issue-<hash>.js`. */
const viewChunk = (name: string) => new RegExp(`/assets/${name}-[\\w-]{8}\\.js$`, "u");
const ISSUE_CHUNK = viewChunk("issue");
/** The new issue page, which the shell draws in the issue frame. */
const issueFrameOn = (page: Page) => withIssuePage(page.context(), "alice");
const issueHref = (title: string) => async (page: Page) => `/issues/${await runIssue(page, title)}`;
/** The issue frame: main is full width, and no content panel is drawn. */
async function issueFrameDrawn(page: Page): Promise<void> {
  await expect(page.locator(`main${MAIN}[data-shell-layout="full-width"]`)).toBeVisible();
  await expect(page.locator('[data-testid="content-panel"]')).toHaveCount(0);
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
const inboxHeading = (page: Page) => [heading(page, "Inbox")];
const onInbox = {
  href: "/",
  prepare: seedAsk,
  ready: (page: Page) => [heading(page, "Inbox"), page.getByText(ASK).first()],
};
async function signOutFromMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Signed in as / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
}

const machineLogin: Region = {
  name: "machine login page",
  href: "/credentials/machine",
  selector: MAIN,
  ready: (page) => [heading(page, "Enter machine login code")],
};
const revokeButton = (page: Page) =>
  page.getByRole("button", { name: /^Revoke the machine login for worker-7\.example\.com/ });
const machineLoginListed: Region = {
  ...machineLogin,
  name: "machine login page with a login listed",
  prepare: seedListedLogin,
  ready: (page) => [heading(page, "Enter machine login code"), revokeButton(page)],
};
const notFoundPage: Region = {
  name: "not-found page",
  href: `/${runName.toLowerCase()}-no-such-page`,
  selector: MAIN,
  ready: (page) => [heading(page, "Page not found")],
};
// The issue frame draws upstream's icon rail and page in the fork's frame.
const issueFrame: Region = {
  name: "issue frame",
  href: issueHref("frame issue"),
  selector: SHELL,
  exclude: [`${MAIN} > *`],
  prepare: issueFrameOn,
  ready: (page) => [page.getByRole("heading", { name: `${runName} frame issue` })],
  drawn: issueFrameDrawn,
};
const connectionErrorPage: Region = {
  name: "connection error page",
  href: "/",
  selector: ROOT,
  prepare: async (page) => {
    await page.route("**/auth/whoami", (route) => route.fulfill({ status: 500 }));
  },
  ready: (page) => [page.getByRole("alert").filter({ hasText: "Could not reach Dispatch." })],
};

const regions: readonly Region[] = [
  // The skip link, the status corner and the content panel's frame.
  { ...onInbox, name: "frame", selector: SHELL, exclude: [MAIN, SIDEBAR] },
  { ...onInbox, name: "sidebar", selector: SIDEBAR },
  {
    ...onInbox,
    name: "account menu",
    selector: '[role="menu"]',
    tabStops: "skip",
    open: async (page) => {
      await page.getByRole("button", { name: /^Signed in as / }).click();
      await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
    },
  },
  { ...onInbox, name: "compact header", selector: `${SHELL} > header`, viewport: PHONE },
  {
    ...onInbox,
    name: "navigation drawer",
    selector: '[role="dialog"]',
    viewport: PHONE,
    open: async (page) => {
      await page.getByRole("button", { name: "Menu" }).click();
      await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
    },
  },
  // The panel, and the page's heading row above upstream's Inbox.
  { ...onInbox, name: "content panel", selector: '[data-testid="content-panel"]' },
  {
    ...onInbox,
    name: "shortcuts sheet",
    selector: '[role="dialog"]',
    open: async (page) => {
      await page.locator(MAIN).focus();
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    },
  },
  // The tooltip that names a control's command and its keys.
  {
    ...onInbox,
    name: "key tooltip",
    selector: TOOLTIP,
    tabStops: "skip",
    open: async (page) => {
      await page.locator(SIDEBAR).getByRole("button", { name: "Hide sidebar" }).hover();
      await expect(page.locator(TOOLTIP)).toContainText("Hide sidebar");
    },
  },
  // The question opens only over an unsent change. Nothing here answers it.
  {
    name: "sign-out question",
    href: "/",
    selector: '[role="alertdialog"]',
    ready: inboxHeading,
    open: async (page) => {
      await heldStatusChange(page, "held issue");
      await signOutFromMenu(page);
      await expect(page.getByRole("alertdialog", { name: "Sign out?" })).toBeVisible();
    },
  },
  {
    name: "status corner with a refused sign-out",
    href: "/",
    selector: STATUS_CORNER,
    // A refused sign-out draws the refusal and keeps the session. An aborted one would not: the
    // page sends it again, as any write that got no answer.
    prepare: async (page) => {
      await page.route(`**${SIGN_OUT}`, (route) =>
        route.fulfill({ status: 403, json: { error: "Sign-out refused" } })
      );
    },
    ready: inboxHeading,
    open: async (page) => {
      await signOutFromMenu(page);
      await expect(
        page.locator(STATUS_CORNER).getByRole("button", { name: "Retry" })
      ).toBeVisible();
    },
  },
  {
    name: "status corner with live updates stopped",
    href: "/",
    selector: STATUS_CORNER,
    // The first live socket closes as a restart closes it, and each one after waits unanswered.
    prepare: async (page) => {
      await page.clock.install();
      let first = true;
      await page.routeWebSocket(/\/ws\/live$/u, async (route) => {
        if (!first) return new Promise<void>(() => undefined);
        first = false;
        await route.close({ code: 1012 });
      });
    },
    ready: inboxHeading,
    open: async (page) => {
      await expect(page.getByText("Reconnecting…")).toBeVisible();
      await page.clock.fastForward(LIVE_SOCKET_STUCK_MS);
      await expect(page.getByText("Live updates are not reaching this page")).toBeVisible();
    },
  },
  notFoundPage,
  machineLogin,
  // The logins table: each row's Revoke, and its cut text, which is a button.
  machineLoginListed,
  {
    ...machineLogin,
    name: "machine login page with a login looked up",
    prepare: seedMachineLogin,
    open: async (page) => {
      await page.getByLabel("Code shown on the machine").fill(MACHINE_CODE);
      await page.getByRole("button", { name: "Look up" }).click();
      await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
    },
  },
  // Nothing here answers it.
  {
    ...machineLoginListed,
    name: "revoke question",
    selector: '[role="alertdialog"]',
    open: async (page) => {
      await revokeButton(page).click();
      await expect(
        page.getByRole("alertdialog", { name: "Revoke worker-7.example.com?" })
      ).toBeVisible();
    },
  },
  {
    ...machineLogin,
    name: "machine login page whose read failed",
    prepare: async (page) => {
      await page.route("**/api/v1/credentials/capabilities", (route) =>
        route.fulfill({ status: 500 })
      );
    },
    ready: (page) => [page.getByText("Could not load the machine login page.")],
  },
  {
    name: "page fallback",
    href: "/machines",
    selector: MAIN,
    prepare: hold(viewChunk("machines")),
    ready: (page) => [page.getByRole("status", { name: "Loading the page" })],
    settles: false,
    tabStops: "none",
  },
  {
    name: "issue page fallback",
    href: issueHref("fallback issue"),
    selector: MAIN,
    prepare: hold(ISSUE_CHUNK),
    ready: (page) => [page.locator(`${MAIN} [aria-busy="true"]`)],
    settles: false,
    tabStops: "none",
  },
  issueFrame,
  {
    name: "issue frame fallback",
    href: issueHref("frame fallback issue"),
    selector: MAIN,
    prepare: async (page) => {
      await issueFrameOn(page);
      await hold(ISSUE_CHUNK)(page);
    },
    ready: (page) => [page.locator(`${MAIN} [aria-busy="true"]`)],
    settles: false,
    drawn: issueFrameDrawn,
    tabStops: "none",
  },
  {
    name: "loading page",
    href: "/",
    selector: ROOT,
    // Never answered, so the sign-in check stays out.
    prepare: hold("**/auth/whoami"),
    ready: (page) => [page.getByRole("status", { name: "Loading Dispatch" })],
    settles: false,
    tabStops: "none",
  },
  connectionErrorPage,
];

/** Regions only a reader nobody signed in sees. */
const signedOutRegions: readonly Region[] = [
  {
    name: "sign-in page",
    href: "/",
    selector: ROOT,
    ready: (page) => [heading(page, "Make the next decision clear.")],
  },
];

/** The pages the fork draws, each read at every width with upstream's views hidden. */
const forkPages: readonly Region[] = [
  { ...onInbox, name: "Inbox's frame", selector: SHELL },
  machineLoginListed,
  notFoundPage,
  issueFrame,
  connectionErrorPage,
];

async function openRegion(page: Page, region: Region): Promise<void> {
  if (region.viewport !== undefined) await page.setViewportSize(region.viewport);
  await region.prepare?.(page);
  const href = typeof region.href === "string" ? region.href : await region.href(page);
  const traffic = watchTraffic(page);
  await page.goto(href);
  for (const locator of region.ready(page)) await expect(locator).toBeVisible();
  await expect(page.locator("[data-markdown-pending]")).toHaveCount(0);
  if (region.settles !== false) await waitForQuiet(traffic, "requests settle");
  await region.open?.(page);
  await expect(page.locator(region.selector), `${region.name}: one element`).toHaveCount(1);
  for (const selector of region.exclude ?? []) {
    await expect(page.locator(selector).first(), `${region.name}: ${selector}`).toBeAttached();
  }
}

/**
 * The fork elements inside an upstream mark of `region`, outside what the row leaves out. The
 * nearest mark decides, so axe reads them again; an upstream mark inside them stays out.
 */
const forkViewsOf = (region: Region) =>
  `${region.selector} ${UPSTREAM_VIEW} ${FORK_VIEW}${(region.exclude ?? [])
    .map((selector) => `:not(${selector}, ${selector} *)`)
    .join("")}`;

/** As upstream's run: no colour is read part-way through a transition after the scheme changes. */
async function stopTransitions(page: Page): Promise<void> {
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
}

/** Runs `body` in light, then in dark, each once `region` is drawn in that scheme. */
async function inEachScheme(
  page: Page,
  region: Region,
  body: (scheme: Scheme) => Promise<void>
): Promise<void> {
  await stopTransitions(page);
  const backgrounds = new Set<string>();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await region.drawn?.(page);
    backgrounds.add(
      await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    );
    await body(scheme);
  }
  // A check that read one scheme twice proves nothing about the other.
  expect(backgrounds.size, `${region.name}: light and dark draw different backgrounds`).toBe(2);
}

/** The serious and critical findings in `region`, in light and dark. */
async function scan(page: Page, region: Region): Promise<Finding[]> {
  const findings: Finding[] = [];
  await inEachScheme(page, region, async (scheme) => {
    const builder = new AxeBuilder({ page })
      .include(region.selector)
      .exclude(UPSTREAM_VIEW)
      .withTags(AXE_TAGS);
    for (const selector of region.exclude ?? []) builder.exclude(selector);
    // Axe refuses an include that matches nothing.
    const forkViews = forkViewsOf(region);
    if ((await page.locator(forkViews).count()) > 0) builder.include(forkViews);
    const results = await builder.analyze();
    await test.info().attach(`axe ${region.name} ${scheme}.json`, {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });
    // A scan whose excludes left it nothing to read passes every rule it never ran.
    expect(results.passes.length, `${region.name}: rules that read something`).toBeGreaterThan(0);
    for (const violation of results.violations) {
      for (const node of violation.nodes) {
        const impact = node.impact ?? violation.impact;
        if (impact !== "serious" && impact !== "critical") continue;
        const selector = node.target
          .map((part) => (Array.isArray(part) ? part.join(" ") : String(part)))
          .join(" ");
        findings.push({ rule: violation.id, impact, scheme, selector });
      }
    }
  });
  return findings;
}

/** Where the focus rests after a Tab press. */
interface Stop {
  /** "first" when the focus is back at the walk's first stop, "again" at another stop the walk
   *  has passed, else null. */
  passed: "first" | "again" | null;
  /** The element's tag and name. */
  name: string;
  /** In the region, and not in what it leaves out. */
  inRegion: boolean;
  /** Its outline: style, width and colour. */
  outline: string;
  /** FO1's outline shows on it: 2 px, in the `--focus` colour, on a box that is drawn. */
  outlined: boolean;
}

/** A Tab stop in a region that does not show FO1's outline. */
type Unmarked = Pick<Stop, "name" | "outline"> & { scheme: Scheme };

/** The `--focus` colour in the scheme shown, as the browser computes it. */
async function focusColour(page: Page): Promise<string> {
  const colour = await page.evaluate(() => {
    if (getComputedStyle(document.documentElement).getPropertyValue("--focus") === "") return null;
    const probe = document.createElement("span");
    probe.style.color = "var(--focus)";
    document.body.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return computed;
  });
  expect(colour, "the theme sets --focus").not.toBeNull();
  return colour ?? "";
}

/** The element that has the focus, read in the page, and marked as a stop of this walk: as its
 *  first stop on the walk's first press. The body stands for nothing having the focus. The body
 *  is marked only as a first stop, so a page with no stop comes round, and the focus can leave
 *  the page more than once before Tab comes back. The read waits two animation frames: a modal
 *  dialog's focus guard takes the focus from Tab and moves it on in the next frame, so one frame
 *  is enough, and the second is spare. */
async function readStop({
  first,
  focus,
  left,
  region,
}: {
  first: boolean;
  focus: string;
  left: readonly string[];
  region: string;
}): Promise<Stop> {
  await new Promise((settled) => requestAnimationFrame(() => requestAnimationFrame(settled)));
  const element = document.activeElement ?? document.body;
  const nothing = element === document.body;
  const mark = element.getAttribute("data-tab-walk");
  if (first || !nothing) element.setAttribute("data-tab-walk", first ? "first" : "");
  const passed = mark === "first" ? "first" : mark === null ? null : "again";
  if (nothing) {
    return { passed, inRegion: false, name: "nothing", outline: "", outlined: false };
  }
  const label = element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40);
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return {
    passed,
    inRegion:
      element.closest(region) !== null &&
      !left.some((selector) => element.closest(selector) !== null),
    name: `${element.tagName.toLowerCase()} "${label ?? ""}"`,
    outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
    outlined:
      style.outlineStyle !== "none" &&
      style.outlineWidth === "2px" &&
      style.outlineColor === focus &&
      box.width > 0 &&
      box.height > 0 &&
      element.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
  };
}

/** The Tab stops in `region` that do not show FO1's outline, in light and dark. Each walk goes
 *  round the page until Tab comes back to its first stop, and fails at any other stop Tab comes
 *  back to first. A region with `tabStops: "none"` must have no stop at all. */
async function walk(page: Page, region: Region): Promise<Unmarked[]> {
  const left = [UPSTREAM_VIEW, ...(region.exclude ?? [])];
  const unmarked: Unmarked[] = [];
  const focusColours = new Set<string>();
  await inEachScheme(page, region, async (scheme) => {
    const focus = await focusColour(page);
    focusColours.add(focus);
    await page.evaluate(() => {
      for (const element of document.querySelectorAll("[data-tab-walk]")) {
        element.removeAttribute("data-tab-walk");
      }
    });
    let stops = 0;
    for (let press = 0; ; press += 1) {
      expect(press, `${region.name}: Tab comes back to its first stop`).toBeLessThan(
        MAX_TAB_PRESSES
      );
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(readStop, {
        first: press === 0,
        focus,
        left,
        region: region.selector,
      });
      if (stop.passed === "first") break;
      expect(
        stop.passed,
        `${region.name}: Tab came back to ${stop.name} before its first stop`
      ).toBeNull();
      if (!stop.inRegion) continue;
      stops += 1;
      if (!stop.outlined) unmarked.push({ scheme, name: stop.name, outline: stop.outline });
    }
    if (region.tabStops === "none") {
      expect(stops, `${region.name}: no Tab stop in the region in ${scheme}`).toBe(0);
    } else {
      // A walk that stopped nowhere in the region proves nothing about it.
      expect(stops, `${region.name}: Tab stops in the region in ${scheme}`).toBeGreaterThan(0);
    }
  });
  expect(focusColours.size, `${region.name}: light and dark draw different focus colours`).toBe(2);
  return unmarked;
}

/** What scrolls sideways once upstream's views and what `region` leaves out are hidden: the page
 *  itself, and each box that scrolls. A table's own box may scroll (FR4): packages/ui's Table
 *  scrolls a table wider than its column inside that box. What the content panel clips, from
 *  768 px, scrolls nothing, so it is not found. */
async function sidewaysScrolls(page: Page, region: Region): Promise<string[]> {
  const hidden = [UPSTREAM_VIEW, ...(region.exclude ?? [])].join(", ");
  await page.addStyleTag({ content: `${hidden} { display: none !important; }` });
  return page.evaluate((table) => {
    const scrolls: string[] = [];
    const root = document.scrollingElement ?? document.documentElement;
    if (root.scrollWidth > root.clientWidth) {
      scrolls.push(`the page: ${root.scrollWidth} px in ${root.clientWidth} px`);
    }
    for (const box of document.body.querySelectorAll(`:not(${table})`)) {
      const { overflowX } = getComputedStyle(box);
      if (overflowX !== "auto" && overflowX !== "scroll") continue;
      if (box.scrollWidth <= box.clientWidth) continue;
      const name =
        box.getAttribute("data-testid") ??
        box.getAttribute("data-slot") ??
        box.getAttribute("aria-label") ??
        box.getAttribute("class")?.slice(0, 60);
      scrolls.push(
        `${box.tagName.toLowerCase()} "${name ?? ""}": ${box.scrollWidth} px in ${box.clientWidth} px`
      );
    }
    return scrolls;
  }, '[data-slot="table-container"]');
}

function scanEach(list: readonly Region[]): void {
  for (const region of list) {
    test(`the ${region.name} has no serious or critical axe finding in light or dark`, async ({
      page,
    }) => {
      await openRegion(page, region);
      expect(await scan(page, region), `${region.name}: serious or critical findings`).toEqual([]);
    });
  }
}

function walkEach(list: readonly Region[]): void {
  for (const region of list) {
    if (region.tabStops === "skip") continue;
    const shows =
      region.tabStops === "none" ? "has no Tab stop" : "shows the focus outline at each Tab stop";
    test(`the ${region.name} ${shows} in light and dark`, async ({ page }) => {
      await openRegion(page, region);
      expect(await walk(page, region), `${region.name}: Tab stops without the outline`).toEqual([]);
    });
  }
}

function fitEach(list: readonly Region[]): void {
  for (const region of list) {
    for (const viewport of WIDTHS) {
      test(`the ${region.name} scrolls nothing sideways at ${viewport.width} px`, async ({
        page,
      }) => {
        await openRegion(page, { ...region, viewport });
        expect(
          await sidewaysScrolls(page, region),
          `${region.name} at ${viewport.width} px`
        ).toEqual([]);
      });
    }
  }
}

scanEach(regions);
walkEach(regions);
fitEach(forkPages);

test.describe("signed out", () => {
  test.use({ signedIn: false });
  scanEach(signedOutRegions);
  walkEach(signedOutRegions);
  fitEach(signedOutRegions);
});

// The run's own controls, on the machine login page: an input with no label fails the scan in the
// fork's page, which main draws inside upstream's error boundary and its `ForkView`, and passes in
// an upstream widget's mark, which the scan leaves out. Without that `ForkView` the page is under
// the boundary's mark alone, and the first control passes, so it fails.
const appendInput = (parent: Locator) =>
  parent.evaluate((at) => at.append(document.createElement("input")));

test("an input without its label fails the scan in a fork region", async ({ page }) => {
  await openRegion(page, machineLogin);
  await appendInput(heading(page, "Enter machine login code").locator(".."));
  const findings = await scan(page, machineLogin);
  expect(findings.map(({ rule, impact, scheme }) => ({ rule, impact, scheme }))).toEqual([
    { rule: "label", impact: "critical", scheme: "light" },
    { rule: "label", impact: "critical", scheme: "dark" },
  ]);
});

test("an input without its label inside an upstream widget's wrapper is left out", async ({
  page,
}) => {
  await openRegion(page, machineLogin);
  // The live views' mark, the last child of main.
  await appendInput(page.locator(`${MAIN} > ${UPSTREAM_VIEW}`).last());
  await expect(page.locator(`${MAIN} ${UPSTREAM_VIEW} > input`)).toHaveCount(1);
  expect(await scan(page, machineLogin)).toEqual([]);
});

// The run's own controls for the walk and the widths, on the machine login page: a button with no
// outline, a thin one or one in another colour fails the walk, and content wider than a phone
// fails the width check.
test("a control without FO1's outline fails the Tab walk", async ({ page }) => {
  await openRegion(page, machineLogin);
  await page.locator(MAIN).evaluate((at) => {
    for (const [name, outline] of [
      ["No outline", "none"],
      ["Thin outline", "1px solid var(--focus)"],
      ["Other colour", "2px solid rgb(0, 128, 0)"],
    ] as const) {
      const button = document.createElement("button");
      button.textContent = name;
      button.style.outline = outline;
      at.append(button);
    }
  });
  const unmarked = await walk(page, machineLogin);
  expect(unmarked.map(({ scheme, name }) => ({ scheme, name }))).toEqual([
    { scheme: "light", name: 'button "No outline"' },
    { scheme: "light", name: 'button "Thin outline"' },
    { scheme: "light", name: 'button "Other colour"' },
    { scheme: "dark", name: 'button "No outline"' },
    { scheme: "dark", name: 'button "Thin outline"' },
    { scheme: "dark", name: 'button "Other colour"' },
  ]);
});

test("a Tab loop that never comes back to the first stop fails the Tab walk", async ({ page }) => {
  await openRegion(page, machineLogin);
  await page.locator(MAIN).evaluate((at) => {
    const button = (name: string) => {
      const made = document.createElement("button");
      made.textContent = name;
      made.style.outline = "2px solid var(--focus)";
      at.append(made);
      return made;
    };
    const one = button("Loop one");
    const two = button("Loop two");
    two.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || event.shiftKey) return;
      event.preventDefault();
      one.focus();
    });
  });
  await expect(walk(page, machineLogin)).rejects.toThrow(
    'Tab came back to button "Loop one" before its first stop'
  );
});

/** Adds content 2000 px wide and 1 px high to `parent`, wider than each width the check reads.
 *  Content with no height adds nothing to scroll to. */
const appendWide = (page: Page, parent: string) =>
  page.locator(parent).evaluate((at) => {
    const wide = document.createElement("div");
    wide.style.cssText = "width: 2000px; height: 1px";
    at.append(wide);
  });

test("a box that scrolls sideways fails the width check", async ({ page }) => {
  await openRegion(page, { ...machineLogin, viewport: PHONE });
  await page.locator(MAIN).evaluate((at) => {
    const box = document.createElement("div");
    box.dataset.testid = "wide-box";
    box.style.overflowX = "auto";
    at.append(box);
  });
  await appendWide(page, '[data-testid="wide-box"]');
  expect(await sidewaysScrolls(page, machineLogin)).toEqual([
    expect.stringMatching(/^div "wide-box": 2000 px in \d+ px$/),
  ]);
});

test("content wider than a phone widens the page and fails the width check at 390 px only", async ({
  page,
}) => {
  await openRegion(page, { ...machineLogin, viewport: PHONE });
  await appendWide(page, MAIN);
  for (const viewport of WIDTHS) {
    await page.setViewportSize(viewport);
    expect(await sidewaysScrolls(page, machineLogin), `at ${viewport.width} px`).toEqual(
      viewport === PHONE ? [expect.stringMatching(/^the page: \d+ px in \d+ px$/)] : []
    );
  }
});
