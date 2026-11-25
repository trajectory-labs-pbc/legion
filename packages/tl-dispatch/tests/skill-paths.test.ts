import { describe, expect, test } from "bun:test";
import { join, relative } from "node:path";

import { agentDocuments, missingPaths } from "./skill-paths";
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
      "These exist: `src/pages`, `page-link.tsx`, `packages/ui`, `features/refs/routes.ts`,",
      "`@upstream-dispatch/features/shell/keymap`, `app.tsx`, `commands/SKILL.md`.",
      "These name no path: `g d`, `$mod+k`, `max-w-1/2`, `@legion/ui`, `<context>.<name>`.",
      "```sh\nbun test src/no-such-folder\n```",
    ].join("\n");
    expect(missingPaths([{ file, text }]).map((line) => line.split(" names ")[1])).toEqual([
      "src/commands/no-such-file.ts, which does not exist",
      "no-such-file.ts, which does not exist",
      "packages/tl-dispatch/src/nowhere, which does not exist",
      "@upstream-dispatch/features/shell/no-such-module, which does not exist",
      ".agents/skills/none/SKILL.md, which does not exist",
    ]);
  });
});
