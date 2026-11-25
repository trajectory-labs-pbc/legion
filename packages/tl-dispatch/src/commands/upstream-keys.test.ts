import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  type KeyRegistration,
  keyRegistrations,
  upstreamKeyRegistrations,
} from "../../tests/key-registrations";
import { UPSTREAM_WEB } from "../../tests/source";
import { APP_CONTEXTS } from "./app-catalog";
import { clashes, keyChecker, refuses } from "./keys";
import type { CommandContext } from "./schema";
import { UPSTREAM_LABELS } from "./upstream-labels";

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
    const theirs: KeyRegistration[] = [
      { file: "page.tsx", line: 1, scope: "issue", id: "x", label: "X", keys: "x" },
    ];
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

/**
 * Upstream's files whose bindings are built in a table outside the registering call, so the
 * scanner reads no scope for them, with the scope that call names.
 */
const TABLE_SCOPES: Readonly<Record<string, string>> = {
  "features/issue-page/useIssueKeymap.ts": "issue",
  "features/issue-page/useTreeKeymap.ts": "issue",
  "features/issue/IssuePage.tsx": "issue",
};

const upstreamFile = (file: string) => file.replace(/^\.\.\/dispatch\/web\/src\//, "");
const scopeOf = (binding: KeyRegistration) =>
  binding.scope ?? TABLE_SCOPES[upstreamFile(binding.file)];

describe("our labels for upstream's bindings", () => {
  test("every upstream binding has a scope: written, declared with a literal, or listed here", () => {
    const unscoped = upstream.filter((binding) => scopeOf(binding) === undefined);
    expect(unscoped.map((binding) => `${upstreamFile(binding.file)}:${binding.line}`)).toEqual([]);
  });

  test("each names a binding upstream registers in its scope, whose label is still the one we shorten", () => {
    const drift = Object.entries(UPSTREAM_LABELS).flatMap(([key, entry]) => {
      const [scope, id] = key.split(":");
      const labels = [
        ...new Set(
          upstream
            .filter((binding) => binding.id === id && scopeOf(binding) === scope)
            .map((binding) => binding.label)
        ),
      ];
      return labels.length === 1 && labels[0] === entry?.upstream
        ? []
        : [`${key}: ours shortens "${entry?.upstream}", upstream has ${JSON.stringify(labels)}`];
    });
    expect(drift).toEqual([]);
  });
});
