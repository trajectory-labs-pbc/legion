# tl-dispatch

A second Dispatch web app: it shows upstream's pages in its own shell and replaces them one page at a time.
Before you change it, read the skill for your task.

- `.agents/skills/ui-design-system/SKILL.md`: the layout and interaction rules taken from Linear, the theme tokens, and when to use or add a `packages/ui` component.

- `.agents/skills/commands/SKILL.md`: the command catalog, `CommandButton`, `HotkeyTooltip`, scopes and overlays, and the shortcuts sheet.

- `.agents/skills/navigation/SKILL.md`: page files, `PageLink`, the navigation hooks, and why only `src/navigation` and `src/app` import the router.

- `.agents/skills/porting-upstream/SKILL.md`: how to port an upstream commit to a rebuilt page, and the checks in `tests/map` that fail in a sync pull request.

- `.agents/skills/react-quality/SKILL.md`: the code bar, with a bad and a good example for each rule.

## Paths

This file and the skills write a path one way: `src/...` and `tests/...` are from `packages/tl-dispatch`, `references/...` is from the skill's own folder, and every other path is from the repository root.
A file named alone is a file of that name anywhere in `packages/tl-dispatch`, beside the document or at the repository root, so the name proves only that such a file exists.
`tests/skill-paths.test.ts` fails on a path in an inline code span that does not exist when read this way.
