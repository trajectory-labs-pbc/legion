import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EAGER } from "../tests/layers.table";
import { eagerPages, missingEager } from "./check-entry-modules";

const src = "packages/tl-dispatch/src";
const entry = (modules: string[]) => ({ modules });
const UPSTREAM_INBOX = "packages/dispatch/web/src/features/inbox/Inbox.tsx";

describe("the page modules that load before first paint", () => {
  test("are each feature's files but its route file, and each upstream view", () => {
    const modules = [
      `${src}/features/agents/page.tsx`,
      `${src}/features/machine-login/machine-login-page.tsx`,
      `${src}/features/agents/view.ts`,
      `${src}/upstream/views/machines.ts`,
      `${src}/upstream/views/inbox/answers.tsx`,
    ];
    expect(eagerPages(entry(modules))).toEqual(modules);
  });

  test("are not the modules the layering table names as eager", () => {
    const modules = Object.keys(EAGER).map((path) => `packages/tl-dispatch/${path}`);
    expect(modules).not.toHaveLength(0);
    expect(eagerPages(entry(modules))).toEqual([]);
    expect(missingEager(entry(modules))).toEqual([]);
  });

  test("include a module the eager not-found page imports, once EAGER leaves it out", () => {
    const notFound = "src/features/not-found/not-found.tsx";
    const { [notFound]: _, ...eager } = EAGER;
    expect(eagerPages(entry([`packages/tl-dispatch/${notFound}`]), eager)).toEqual([
      `packages/tl-dispatch/${notFound}`,
    ]);
  });

  test("name the seam view whose upstream module loads, once EAGER leaves the view out", () => {
    const view = "src/upstream/views/inbox/inbox.tsx";
    expect(eagerPages(entry([UPSTREAM_INBOX]))).toEqual([]);
    const { [view]: _, ...eager } = EAGER;
    expect(eagerPages(entry([UPSTREAM_INBOX]), eager)).toEqual([
      `${UPSTREAM_INBOX}, the upstream view of ${view}`,
    ]);
  });

  test("miss each module the layering table names as eager and the entry does not hold", () => {
    expect(missingEager(entry([]))).toEqual(Object.keys(EAGER));
  });

  test("are not a route file, a test, the shell or upstream's own code", () => {
    const modules = [
      `${src}/features/inbox/route.tsx`,
      `${src}/features/agents/route.ts`,
      `${src}/features/inbox/page.test.tsx`,
      `${src}/shell/app-shell.tsx`,
      `${src}/upstream/queries.ts`,
      "packages/dispatch/web/src/features/inbox/InboxBar.tsx",
    ];
    expect(eagerPages(entry(modules))).toEqual([]);
  });
});

describe("the check", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "entry-modules-"));
  });
  afterEach(() => rmSync(dir, { recursive: true }));

  const run = (modules: string[]) => {
    const file = join(dir, "entry-modules.json");
    writeFileSync(file, JSON.stringify(entry(modules)));
    return Bun.spawnSync(["bun", join(import.meta.dir, "check-entry-modules.ts"), file]);
  };

  test("fails and names a page that loads before first paint", () => {
    const result = run([`${src}/shell/app-shell.tsx`, `${src}/features/agents/page.tsx`]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(`${src}/features/agents/page.tsx`);
  });

  const eager = Object.keys(EAGER).map((path) => `packages/tl-dispatch/${path}`);

  test("fails and names a module EAGER names that does not load before first paint", () => {
    const [first, ...rest] = eager;
    const result = run([`${src}/shell/app-shell.tsx`, ...rest]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain(first?.slice("packages/tl-dispatch/".length));
  });

  test("passes when only the modules EAGER names do", () => {
    expect(run([`${src}/shell/app-shell.tsx`, UPSTREAM_INBOX, ...eager]).exitCode).toBe(0);
  });
});
