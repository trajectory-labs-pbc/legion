// The axe run: each region the fork draws, in light and in dark, read by axe at WCAG 2.0 and 2.1
// level A and AA, the tags upstream's accessibility.e2e.ts reads its pages at. A row fails on any
// serious or critical finding, and accepts none. Each scan leaves out what upstream draws inside
// the region: each component of the seam draws inside a `data-upstream-view` mark, and upstream's
// own axe run reads those. Fork elements passed into a marked component sit in a
// `data-fork-view` mark inside it, which the scan reads again. The run seeds, so it is local
// only: the deployed mode leaves this file out (modes.ts).
// It also probes the pointer target of each small control the app draws (PT2).
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
const PHONE = { width: 390, height: 844 };
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

interface Region {
  name: string;
  /** The path to open, or how to make the record it names. */
  href: string | ((page: Page) => Promise<string>);
  /** The region's element; axe reads only inside it. */
  selector: string;
  /** What axe leaves out of it beside upstream's widgets: a region another row reads, or an
   *  upstream page. */
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
  /** What the region must draw in each scheme, checked before that scheme's scan. */
  drawn?: (page: Page) => Promise<void>;
}

/** A serious or critical axe finding. */
interface Finding {
  rule: string;
  impact: string;
  scheme: (typeof SCHEMES)[number];
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

const regions: readonly Region[] = [
  // The skip link, the status corner and the content panel's frame.
  { ...onInbox, name: "frame", selector: SHELL, exclude: [MAIN, SIDEBAR] },
  { ...onInbox, name: "sidebar", selector: SIDEBAR },
  {
    ...onInbox,
    name: "account menu",
    selector: '[role="menu"]',
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
  {
    name: "not-found page",
    href: `/${runName.toLowerCase()}-no-such-page`,
    selector: MAIN,
    ready: (page) => [heading(page, "Page not found")],
  },
  machineLogin,
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
  },
  {
    name: "issue page fallback",
    href: issueHref("fallback issue"),
    selector: MAIN,
    prepare: hold(ISSUE_CHUNK),
    ready: (page) => [page.locator(`${MAIN} [aria-busy="true"]`)],
    settles: false,
  },
  // The issue frame draws upstream's icon rail and page in the fork's frame.
  {
    name: "issue frame",
    href: issueHref("frame issue"),
    selector: SHELL,
    exclude: [`${MAIN} > *`],
    prepare: issueFrameOn,
    ready: (page) => [page.getByRole("heading", { name: `${runName} frame issue` })],
    drawn: issueFrameDrawn,
  },
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
  },
  {
    name: "loading page",
    href: "/",
    selector: ROOT,
    // Never answered, so the sign-in check stays out.
    prepare: hold("**/auth/whoami"),
    ready: (page) => [page.getByRole("status", { name: "Loading Dispatch" })],
    settles: false,
  },
  {
    name: "connection error page",
    href: "/",
    selector: ROOT,
    prepare: async (page) => {
      await page.route("**/auth/whoami", (route) => route.fulfill({ status: 500 }));
    },
    ready: (page) => [page.getByRole("alert").filter({ hasText: "Could not reach Dispatch." })],
  },
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

/** The serious and critical findings in `region`, in light and dark. */
async function scan(page: Page, region: Region): Promise<Finding[]> {
  // As upstream's run: no colour is read part-way through a transition after the scheme changes.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  const findings: Finding[] = [];
  const backgrounds = new Set<string>();
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await region.drawn?.(page);
    backgrounds.add(
      await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    );
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
  }
  // A scan that read one scheme twice proves nothing about the other.
  expect(backgrounds.size, `${region.name}: light and dark draw different backgrounds`).toBe(2);
  return findings;
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

scanEach(regions);

test.describe("signed out", () => {
  test.use({ signedIn: false });
  scanEach(signedOutRegions);
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

// The pointer targets (PT2). The pointer reaches each small control across the 24 px square on its
// centre, and its target meets no other control's: another small control's target, or the box of
// any other control. Probes hit the pseudo-element that grows the target, which no bounding box
// reports. The four slots are PT2's controls; the app draws only the truncated-text one today.
const SMALL_CONTROLS = [
  '[data-slot="checkbox"]',
  '[data-slot="radio-group-item"]',
  '[data-slot="slider-thumb"]',
  'button[data-slot="truncated-text"]',
].join(", ");
/** The controls a pointer can use. A `tabindex="-1"` element (the main region) is a focus target,
 *  not a control. */
const INTERACTIVE =
  'a[href], button, input, select, textarea, [role=checkbox], [role=radio], [role=slider], [tabindex]:not([tabindex="-1"])';

/** A live machine login whose machine name is too long for its cell, so the row cuts it. */
function cutLogin(credentialId: string): FakeLauncherCredential {
  const hour = 60 * 60_000;
  return {
    approved_by: "alice",
    credential_id: credentialId,
    expired: false,
    expires_at: new Date(Date.now() + hour).toISOString(),
    host: `${credentialId}.${"build-runners.".repeat(12)}example.com`,
    issued_at: new Date(Date.now() - hour).toISOString(),
    listedFor: "alice",
    person: null,
    service: null,
    subject: null,
  };
}

/** The machine login page with two rows whose machine names are cut, and their two buttons. */
async function cutRows(page: Page): Promise<Locator> {
  await setLauncherCredentials([cutLogin("cred-cut-1"), cutLogin("cred-cut-2")]);
  await page.goto("/credentials/machine");
  await expect(page.getByRole("region", { name: "Machine logins" })).toBeVisible();
  const controls = page.locator(MAIN).locator(SMALL_CONTROLS);
  await expect(controls).toHaveCount(2);
  return controls;
}

/** What breaks PT2 at `control`. `misses`: each probe of its centre square that the pointer does
 *  not reach it at. `meets`: each other control whose target meets its target. Left out: what the
 *  control holds, what is hidden from assistive tech (Base UI's hidden input beside a checkbox),
 *  a link that holds the control (a row link), and the other thumbs of the same slider. */
async function targetFaults(control: Locator): Promise<{ misses: string[]; meets: string[] }> {
  await control.scrollIntoViewIfNeeded();
  return control.evaluate(
    (element, { interactive, small }) => {
      // A small control's target is its 24 px square, or for cut text a 24 px band as wide as the
      // text; any other control's target is its box.
      const targetOf = (at: Element) => {
        const box = at.getBoundingClientRect();
        if (!at.matches(small)) return box;
        const band = at.matches('[data-slot="truncated-text"]');
        const width = band ? box.width : Math.max(box.width, 24);
        const height = Math.max(box.height, 24);
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        return {
          left: x - width / 2,
          right: x + width / 2,
          top: y - height / 2,
          bottom: y + height / 2,
        };
      };
      const target = targetOf(element);
      const box = element.getBoundingClientRect();
      const side = Math.min(24, target.right - target.left);
      const left = box.left + box.width / 2 - side / 2;
      const top = box.top + box.height / 2 - 12;
      const steps = [0, 0.25, 0.5, 0.75, 1];
      const misses = steps.flatMap((sy) =>
        steps.flatMap((sx) => {
          const x = left + 0.5 + sx * (side - 1);
          const y = top + 0.5 + sy * 23;
          const hit = document.elementFromPoint(x, y);
          return hit !== null && element.contains(hit)
            ? []
            : [`(${x - left}, ${y - top}): ${hit?.outerHTML.slice(0, 80)}`];
        })
      );
      const slider = element.closest('[data-slot="slider"]');
      const others = new Set(document.querySelectorAll(`${interactive}, ${small}`));
      const meets = [...others].flatMap((other) => {
        if (other === element || element.contains(other)) return [];
        if (other.closest('[aria-hidden="true"]') !== null) return [];
        if (other.matches("a[href]") && other.contains(element)) return [];
        const thumb = other.closest('[data-slot="slider-thumb"]');
        if (slider !== null && thumb !== null && slider.contains(thumb)) return [];
        const at = targetOf(other);
        const meet =
          at.right - at.left > 0 &&
          at.bottom - at.top > 0 &&
          at.left < target.right &&
          at.right > target.left &&
          at.top < target.bottom &&
          at.bottom > target.top;
        return meet ? [other.outerHTML.slice(0, 80)] : [];
      });
      return { misses, meets };
    },
    { interactive: INTERACTIVE, small: SMALL_CONTROLS }
  );
}

test("each small control takes the pointer across its 24 px square, and its target meets no other", async ({
  page,
}) => {
  for (const control of await (await cutRows(page)).all()) {
    expect(await targetFaults(control), (await control.textContent()) ?? "").toEqual({
      misses: [],
      meets: [],
    });
  }
});

// The check's own failures: a cut text button with no band is one line of text tall, and a control
// whose box sits in the target meets it even where the pointer passes through it.
test("a small control with no band misses the pointer at its square's edges", async ({ page }) => {
  const control = (await cutRows(page)).first();
  await page.addStyleTag({ content: '[data-slot="truncated-text"]::after { display: none; }' });
  expect((await targetFaults(control)).misses.length).toBeGreaterThan(0);
});

test("a control whose box sits in a small control's target meets it", async ({ page }) => {
  const control = (await cutRows(page)).first();
  await control.scrollIntoViewIfNeeded();
  await control.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const other = document.createElement("button");
    other.style.cssText = `position: fixed; left: ${box.left + box.width / 2}px; top: ${box.top + box.height / 2 - 11}px; width: 2px; height: 2px; padding: 0; pointer-events: none`;
    document.body.append(other);
  });
  const faults = await targetFaults(control);
  expect(faults.meets).toHaveLength(1);
  expect(faults.misses).toEqual([]);
});
