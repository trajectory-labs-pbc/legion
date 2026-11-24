import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  type KeyRegistration,
  keyRegistrations,
  UPSTREAM_WEB,
  upstreamKeyRegistrations,
} from "../../tests/key-registrations";
import { APP_CONTEXTS } from "./app-catalog";
import type { CommandContext } from "./catalog";
import { clashes, keyChecker, refuses } from "./keys";

const upstream = upstreamKeyRegistrations();

/**
 * Each catalog key that clashes with a key an upstream page binds: one starts the other, which
 * the engine refuses in any scope, or both are one key in one scope, where the first registered
 * wins. Upstream's dialogs are left out of the second: global commands stop under them.
 */
function clashesWithUpstream(
  contexts: readonly CommandContext[],
  registrations: readonly KeyRegistration[] = upstream
): string[] {
  const found: string[] = [];
  for (const context of contexts) {
    for (const command of context.commands) {
      for (const keys of command.keys ?? []) {
        const checker = keyChecker([keys]);
        for (const theirs of registrations) {
          const sameScope = theirs.scope === context.scope && theirs.scope !== "dialog";
          if (refuses(checker, theirs.keys) || (sameScope && clashes(checker, theirs.keys))) {
            found.push(
              `${context.name}.${command.name} (${keys}) and ${theirs.file}:${theirs.line} (${theirs.keys})`
            );
          }
        }
      }
    }
  }
  return found;
}

describe("upstream's key registrations", () => {
  test("are found, keys and scopes, so a sync that moves them does not empty this check", () => {
    expect(upstream.length).toBeGreaterThan(100);
    const singleO = upstream.filter((registration) => registration.keys === "o");
    expect(singleO.map((registration) => registration.file)).toEqual(
      expect.arrayContaining([
        "../dispatch/web/src/features/issue-page/useTreeKeymap.ts",
        "../dispatch/web/src/features/architecture/ArchitecturePage.tsx",
      ])
    );
    const tree = singleO.find((registration) => registration.file.endsWith("useTreeKeymap.ts"));
    expect(tree?.scope).toBe("issue");
  });

  test("clash with no key of the catalog", () => {
    expect(clashesWithUpstream(APP_CONTEXTS)).toEqual([]);
  });

  test("an O chord in the catalog clashes with the pages that bind O alone", () => {
    const withPicker: CommandContext[] = [
      {
        name: "global",
        parent: null,
        scope: "global",
        commands: [{ name: "pick", label: "Pick", keys: ["o p"] }],
      },
    ];
    const files = clashesWithUpstream(withPicker).map(
      (clash) => clash.split(" and ")[1]?.split(":")[0]
    );
    expect(files).toEqual(
      expect.arrayContaining([
        "../dispatch/web/src/features/issue-page/useTreeKeymap.ts",
        "../dispatch/web/src/features/architecture/ArchitecturePage.tsx",
      ])
    );
  });

  test("a key equal to one an upstream page binds in the same scope clashes; in another scope it does not", () => {
    const theirs: KeyRegistration[] = [{ file: "page.tsx", line: 1, scope: "issue", keys: "x" }];
    const ours = (scope: CommandContext["scope"]): CommandContext[] => [
      {
        name: "page",
        parent: "global",
        scope,
        commands: [{ name: "act", label: "Act", keys: ["X"] }],
      },
    ];
    expect(clashesWithUpstream(ours("issue"), theirs)).toEqual(["page.act (X) and page.tsx:1 (x)"]);
    expect(clashesWithUpstream(ours("board"), theirs)).toEqual([]);
  });
});

describe("upstream's shell keys", () => {
  test("are the catalog's global keys, so the shell on the catalog changes no key", () => {
    const live = keyRegistrations(join(UPSTREAM_WEB, "app.tsx"))
      .filter((registration) => registration.scope === "global")
      .map((registration) => registration.keys);
    const global = APP_CONTEXTS.find((context) => context.name === "global");
    const catalog = (global?.commands ?? []).flatMap((command) => command.keys ?? []);
    expect(catalog.filter((keys) => !live.includes(keys))).toEqual([]);
    expect(live.filter((keys) => !catalog.includes(keys))).toEqual([]);
  });
});
