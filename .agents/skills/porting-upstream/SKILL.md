---
name: porting-upstream
description: "Use when a view map, copy or link check in packages/tl-dispatch/tests/map fails in a sync pull request from upstream, or you port an upstream commit to a page packages/tl-dispatch has rebuilt."
---

# Port an upstream commit

tl-dispatch draws upstream's pages until it rebuilds them. A rebuilt page no longer gets upstream's view changes for free: each one is a port. Logic files (`api/`, hooks, queries, the write store) are imported as they are and arrive with each sync, so they need no port.

## What to port

- The weekly sync merges upstream's main into the sync branch (`fork-sync`) and keeps one pull request open from it. Nothing else reports a port: no issue is opened.
- The sync pull request runs the gates in `tests/map` (below). A gate fails when an upstream commit changed a view file of a page this app draws, a part this app copied, or a route. Each upstream commit behind a failure is one port.
- Do every port before the sync pull request merges. A red gate is never a flake: read its message.
- Port every fix, new action, new key, new URL form, new view state (empty, loading, error), new live update and copy change.
- Do not port an upstream restyle of a view this app owns: this app's design replaces it. Update the map only.
- A change to upstream's shared controls (`components/`) needs no port: `packages/ui` replaces them.
- A change to a widget (the document editor, conversation, margin, activity, artifacts, agent view) needs no port while the widget stays upstream's.

## Steps

1. Read the failing gate's message in the sync pull request. Note the upstream file and this app's page.
2. Find the upstream commits: `git log --oneline main..fork-sync -- packages/dispatch/web/src/<file>`. Read each: `git show --stat <sha>`, then `git show <sha> -- <file>` for each view file.
3. Decide to port or not by the list above. If the commit both restyles and changes behaviour, port the behaviour only.
4. Find this app's files for the page: its page file in `src/pages/` and its folder `src/pages/<page>/`. The page file's `views` names the upstream files it replaces.
5. Make the change in this app's components. Use `packages/ui` and the design rules (`.agents/skills/ui-design-system/SKILL.md`), not upstream's class strings or markup.
6. Reach upstream code through the page's one upstream module, `src/pages/<page>/upstream.ts`. Add a re-export there; never import `@upstream-dispatch/...` in the page's components. An upstream rename then breaks in one file. A reviewer holds this rule; no test does.
7. Give each new behaviour a parity ID and a test. Port upstream's own test for it, with the ID at the start of its name (`test("MLP-07 a stopped approve says it may have been made", ...)`). See `.agents/skills/react-quality/SKILL.md`.
8. Update the maps if the commit added, renamed or removed a view file, a route or a URL key (see the gates below).
9. Run the gates in `packages/tl-dispatch`: `bun run test`, `bun run typecheck`, `bun run lint`.
10. Commit one upstream commit per commit: `feat(tl-dispatch): port <short sha> to the <page> page`, or `fix(...)` for a fix. The body says what a reader of the page now sees or can do. For a commit that needs no port, the map change's body gives the reason: a restyle, logic only, a shared control, or a widget.
11. Push the commits to the sync branch, or open a pull request on top of it whose title names the upstream sha. Never squash or rebase the sync pull request.

Never edit an upstream file to make a port easier. Every file this repository changes in upstream's tree is on `.github/fork-allowlist.txt`, and `.github/scripts/check-fork-allowlist.sh` fails on any other.

## The gates in tests/map

`bun run test` runs them. Each failure message says what to change.

**The view map** (`coverage.ts`, `coverage.test.ts`). Every `.tsx` view file under upstream's `features/` has exactly one owner: a page's `views`, or a list in `src/views.ts` (`shellViews`, `widgetViews`, `sharedViews`). For a page this app draws (`server: "fork"`), these fail:

- A new upstream file that only that page loads: port what it adds, then name the file in the page's `views`.
- A file that two lists name: keep it in one.
- An entry that matches no upstream file: upstream renamed or removed it. Name the file that replaced it, or drop the entry.
- A page's view that another owner also loads: move it to `sharedViews.pages`, or to the one owner that loads it.
- A glob in the page's `views`: a page this app draws names each file, so a new upstream file shows up.

For a page upstream still draws, the same findings print as notes and do not fail, except a file that two lists name, which fails for every page.
An entry of `replacedViews` in `src/views.ts` fails when its key is not an upstream view file under `features/`; the copies test below holds its value to the `copy` of that file's pin.

**The copies** (`copies.ts`, `copies.json`). Each part of upstream code this app copied (a shell function, a route's lazy import, an inline script) is pinned by a hash of its tokens, so a reformat does not trip it. When upstream changes or removes a pinned part, the test names the part and the command that shows upstream's diff since the copy. Port the change, or close it when it is a restyle of a view the fork replaced, then run `bun tests/map/copies.ts --update <upstream file> <part> --outcome ported|closed --reason <why>`, which pins that part and no other. A pin whose hash or commit changed since the merge base needs its own `outcome` and `reason`, or the test fails. Every name a `<Route>` element of upstream's `app.tsx` refers to must have a pin, and so does each upstream view file in `replacedViews` of `src/views.ts`, whole (`"part": "*"`): a rebuilt region adds its upstream files there.

**The links** (`links.ts`, `links.test.ts`). This app serves every upstream route. A page upstream draws renders exactly upstream's element, props included. A page this app draws keeps the path. A page this app draws lists in `linkForms` each query key and fragment form (`b-` block anchors) that the server or a reference writes to it; an unread one fails.
