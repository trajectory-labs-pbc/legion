import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  copyProblems,
  partText,
  readPins,
  repoRoot,
  unpinnedRouteTargets,
  upstreamDiff,
} from "./copies";

const APP = "packages/dispatch/web/src/app.tsx";
const appText = () => readFileSync(join(repoRoot, APP), "utf8");
const pin = (part: string) => {
  const found = readPins().find((entry) => entry.file === APP && entry.part === part);
  if (!found) throw new Error(`no pin for ${part}`);
  return found;
};
const problemsWith = (text: string, part: string) =>
  copyProblems([pin(part)], (file, name) => partText(file, name, text));

describe("copied upstream code", () => {
  test("upstream has not changed a part this app copies", () => {
    const pins = readPins();
    expect(pins.length).toBeGreaterThan(20);
    const problems = copyProblems(pins);
    for (const entry of pins) {
      if (
        problems.some(
          (line) => line.startsWith(`${entry.file} `) && line.includes(` ${entry.part} `)
        )
      ) {
        console.error(upstreamDiff(entry));
      }
    }
    expect(problems).toEqual([]);
  });

  test("names a part upstream changed, and one it removed", () => {
    const [first] = readPins();
    if (!first) throw new Error("no pins");
    const changed = { ...first, sha256: "0".repeat(64) };
    const removed = { ...first, part: "NoSuchPart" };
    expect(copyProblems([changed, removed])).toEqual([
      `${first.file} changed ${first.part} since ${first.commit.slice(0, 12)}, which ${first.copy} copies: port the change (git diff ${first.commit.slice(0, 12)} -- ${first.file}), then run \`bun src/map/copies.ts --update\``,
      `${first.file} no longer has NoSuchPart since ${first.commit.slice(0, 12)}, which ${first.copy} copies: port the change (git diff ${first.commit.slice(0, 12)} -- ${first.file}), then run \`bun src/map/copies.ts --update\``,
    ]);
  });

  test("a reformat of upstream's file trips no pin", () => {
    const reformatted = appText()
      .replace(/from "([^"]+)"/g, "from '$1'")
      .replace(/\n(const|function|export) /g, "\n// moved\n$1 ")
      .replace(/;\n/g, "\n")
      .replace(/\n/g, "\n  ")
      .replace(/\(\) =>\n\s*import/g, "() => import");
    expect(reformatted).not.toEqual(appText());
    const pins = readPins().filter((entry) => entry.file === APP);
    expect(copyProblems(pins, (file, part) => partText(file, part, reformatted))).toEqual([]);
  });

  test("pins every name a route element of app.tsx refers to", () => {
    expect(unpinnedRouteTargets()).toEqual([]);
  });

  test("names a route target no pin covers", () => {
    expect(unpinnedRouteTargets([], ["IssuePage"])).toEqual([
      `${APP}: a route element refers to IssuePage, which copies.json does not pin: add {"file": "${APP}", "part": "IssuePage", "copy": <the page file that draws it>} and run \`bun src/map/copies.ts --update\``,
    ]);
  });

  test("a page's lazy that loads another module trips its pin", () => {
    const moved = appText().replace(
      '"./features/issue-page/IssuePage"',
      '"./features/issue-page/IssuePageV2"'
    );
    expect(moved).not.toEqual(appText());
    expect(problemsWith(moved, "IssuePage")).toHaveLength(1);
  });

  test("a route import from another module trips its pin", () => {
    const moved = appText().replace(
      'import { NotFoundPage } from "./features/shell/NotFoundPage"',
      'import { NotFoundPage } from "./features/shell/Missing"'
    );
    expect(moved).not.toEqual(appText());
    expect(problemsWith(moved, "NotFoundPage")).toHaveLength(1);
  });
});
