---
name: porting-upstream
description: "Use when you work a port issue, port an upstream commit to a page packages/tl-dispatch has rebuilt, close a port issue, or a view map, copy or link check in packages/tl-dispatch/src/map fails after a sync from upstream."
---

# Port an upstream commit

tl-dispatch draws upstream's pages until it rebuilds them. A rebuilt page no longer gets upstream's view changes for free: each one is a port. Logic files (`api/`, hooks, queries, the write store) are imported as they are and arrive with each sync, so they need no port.

## Port issues

- The weekly sync lists each upstream commit that changed a view file of a rebuilt page, the rebuilt shell, or a shell file (`app.tsx`, `main.tsx`, `index.html`, `vite.config.ts`, `features/refs/routes.ts`). Each commit becomes one GitHub issue in this repository, labelled `port`. The issue names upstream's commit and this app's page, and nothing more.
- Port or close each issue before the next weekly sync.
- Port every fix, new action, new key, new URL form, new view state (empty, loading, error), new live update and copy change.
- Close an upstream restyle of a view this app owns: this app's design replaces it.
- A change to upstream's shared controls (`components/`) needs no port: `packages/ui` replaces them.
- A change to a widget (the document editor, conversation, margin, activity, artifacts, agent view) needs no port while the widget stays upstream's.

## Steps

1. Read the issue. Note the upstream commit and the page.
2. Read the commit: `git show --stat <sha>`, then `git show <sha> -- <file>` for each view file.
3. Decide port or close by the list above. If the commit both restyles and changes behaviour, port the behaviour only.
4. Find this app's files for the page: its page file in `src/pages/` and its folder `src/pages/<page>/`. The page file's `views` names the upstream files it replaces.
5. Make the change in this app's components. Use `packages/ui` and the design rules (`.agents/skills/ui-design-system/SKILL.md`), not upstream's class strings or markup.
6. Reach upstream code through the page's one upstream module, `src/pages/<page>/upstream.ts`. Add a re-export there; never import `@upstream-dispatch/...` in the page's components. An upstream rename then breaks in one file.
7. Give each new behaviour a parity ID and a test. Port upstream's own test for it, with the ID at the start of its name (`test("MLP-07 a stopped approve says it may have been made", ...)`). See `.agents/skills/react-quality/SKILL.md`.
8. Update the maps if the commit added, renamed or removed a view file, a route or a URL key (see the gates below).
9. Run the gates in `packages/tl-dispatch`: `bun run test`, `bun run typecheck`, `bun run lint`.
10. Commit one upstream commit per commit: `feat(tl-dispatch): port <short sha> to the <page> page`, or `fix(...)` for a fix. The body says what a reader of the page now sees or can do.
11. Close the issue (below).

Never edit an upstream file to make a port easier. Every file this repository changes in upstream's tree is on `.github/fork-allowlist.txt`, and `.github/scripts/check-fork-allowlist.sh` fails on any other.

## The gates in src/map

`bun run test` runs them. Each failure message says what to change.

**The view map** (`coverage.ts`, `coverage.test.ts`). Every `.tsx` view file under upstream's `features/` has exactly one owner: a page's `views`, or a list in `src/views.ts` (`shellViews`, `widgetViews`, `sharedViews`). For a page this app draws (`server: "fork"`), these fail:

- A new upstream file that only that page loads: port what it adds, then name the file in the page's `views`.
- A file that two lists name: keep it in one.
- An entry that matches no upstream file: upstream renamed or removed it. Name the file that replaced it, or drop the entry.
- A page's view that another owner also loads: move it to `sharedViews.pages`, or to the one owner that loads it.
- A glob in the page's `views`: a page this app draws names each file, so a new upstream file shows up.

For a page upstream still draws, the same findings print as notes and do not fail.

**The copies** (`copies.ts`, `copies.json`). Each part of upstream code this app copied (a shell function, a route's lazy import, an inline script) is pinned by a hash of its tokens, so a reformat does not trip it. When upstream changes or removes a pinned part, the test names the part and the command that shows upstream's diff since the copy. Port the change, then run `bun src/map/copies.ts --update`. Every name a `<Route>` element of upstream's `app.tsx` refers to must have a pin.

**The links** (`links.ts`, `links.test.ts`). This app serves every upstream route. A page upstream draws renders exactly upstream's element, props included. A page this app draws keeps the path. A page this app draws lists in `linkForms` each query key and fragment form (`b-` block anchors) that the server or a reference writes to it; an unread one fails.

## Close a port issue

Run `gh` in this repository's clone. If `gh` asks which repository, run `gh repo set-default` once.

- Ported: `gh issue close <n> --reason completed --comment "Ported in #<pr>: <what the reader now sees>. Parity: <IDs>."`
- Closed without a port: `gh issue close <n> --reason "not planned" --comment "<reason>"`. Use one of these reasons:
  - "Upstream restyle of a view this app owns; this app's design replaces it."
  - "Logic only; this app imports <file> as it is."
  - "Shared control in components/; packages/ui replaces it."
  - "Widget change; the widget is still upstream's."
  - "Replaced by <sha>, ported in #<pr>."

A closed issue names its pull request or its reason. Never close one with no comment.
