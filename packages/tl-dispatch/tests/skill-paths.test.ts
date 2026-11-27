import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { agentDocuments, missingPaths, ownedSkills, skillsNotNamed } from "./skill-paths";
import { PACKAGE_ROOT, REPO_ROOT } from "./source";

describe("the skills and AGENTS.md", () => {
  test("name only paths that exist", () => {
    const documents = agentDocuments().map((file) => relative(REPO_ROOT, file));
    expect(documents).toContain(".agents/skills/commands/SKILL.md");
    expect(documents).toContain(".agents/skills/ui-design-system/references/tokens.md");
    expect(documents).toContain("packages/tl-dispatch/AGENTS.md");
    expect(missingPaths()).toEqual([]);
  });

  test("control: a path that does not exist is named, in each form a document writes one", () => {
    const file = join(PACKAGE_ROOT, "AGENTS.md");
    const text = [
      "`src/commands/no-such-file.ts`, `no-such-file.ts`, `packages/tl-dispatch/src/nowhere`,",
      "`@upstream-dispatch/features/shell/no-such-module` and `.agents/skills/none/SKILL.md`.",
      "A command: `bun tests/map/no-such.ts --update`, `bun run test src/commands tests/map`.",
      "Read from another root than the convention's: `references/tokens.md`, `commands/SKILL.md`,",
      "`features/refs/routes.ts`, and the folder `@upstream-dispatch/features/shell`.",
      "These exist: `src/pages`, `page-link.tsx`, `packages/ui`, `registry.json`,",
      "`@upstream-dispatch/features/shell/keymap`, `packages/dispatch/web/src/app.tsx`.",
      "These name no path: `g d`, `$mod+k`, `max-w-1/2`, `@legion/ui`, `<context>.<name>`, `3 / 84`,",
      "`git show <sha> -- <file>`, `src/pages/<page>/upstream.ts`.",
      "```sh\nbun test src/no-such-folder\n```",
    ].join("\n");
    expect(missingPaths([{ file, text }])).toEqual(
      [
        "src/commands/no-such-file.ts",
        "no-such-file.ts",
        "packages/tl-dispatch/src/nowhere",
        "@upstream-dispatch/features/shell/no-such-module",
        ".agents/skills/none/SKILL.md",
        "tests/map/no-such.ts",
        "references/tokens.md",
        "commands/SKILL.md",
        "features/refs/routes.ts",
        "@upstream-dispatch/features/shell",
      ].map((path) => ({ document: "packages/tl-dispatch/AGENTS.md", path }))
    );
  });

  test("AGENTS.md names every skill the allowlist gives the fork, and a dropped one fails", () => {
    const text = readFileSync(join(PACKAGE_ROOT, "AGENTS.md"), "utf8");
    expect(skillsNotNamed(text)).toEqual([]);
    const dropped = text
      .split("\n")
      .filter((line) => !line.includes(".agents/skills/navigation/SKILL.md"))
      .join("\n");
    expect(skillsNotNamed(dropped)).toEqual(["navigation"]);
  });

  test("reads an allowlist line as the allowlist check does: comment and spaces aside", () => {
    const allowlist = [
      ".agents/skills/commands/",
      "  .agents/skills/navigation/   # the router rule",
      "# .agents/skills/retired/",
      ".agents/skills/commands/SKILL.md",
    ].join("\n");
    expect(ownedSkills(allowlist)).toEqual(["commands", "navigation"]);
  });
});
