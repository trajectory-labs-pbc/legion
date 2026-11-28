---
name: rebuilding-a-page
description: "Use when you start, build or review the rebuild of one page of packages/tl-dispatch on packages/ui."
---

# Rebuild a page

tl-dispatch shows upstream's page until the fork rebuilds it. A rebuild replaces the page one region at a time. A region is one part of the page that one pull request can replace, for example a list or a reading pane. Every page follows the same sequence and the same file shape, so several pages can be rebuilt at the same time.

During its rebuild, a page has one element from its first pull request: the fork's parts, and upstream's part for each region that is not rebuilt yet. The Inbox is the one exception: until its last pull request, a palette command chooses between upstream's view and the fork's view. If another page cannot have one element, stop and ask the person who approves the page's spec.

## What this skill assumes

The app has the migration's layout: the folders `src/features/<page>/`, `src/parts/<name>/` and `src/app/<file>`, the seam (`src/upstream/<file>`) and its upstream mark, the read and write hooks (`src/data/<resource>.ts`), the browser layer, and the layering table with its list of breaks and `tests/layers.md`. The `read-boundary`, `states`, `view-header`, `list-row` and `selection-bar` blocks and the toast component are in `packages/ui`. These do not exist yet:

| Item | Arrives with |
| --- | --- |
| `PrimaryAction` and `expectOnePrimary` | The Inbox's ask body pull request |
| The shared list part, which registers a list's keys (the `list-row` block draws one row) | The Inbox's pull request that first uses it |
| The toast store, mounted in the shell | The Inbox's pull request that first shows a toast |
| A route file's `linkForms` | The first pull request whose fork-served page reads a query key or a fragment (`tests/map/links.ts`) |

If an item that a region needs is missing, do not build it inside the page: wait for it, or build it where its own pull request puts it.

## Read first

| Skill | When |
| --- | --- |
| `.agents/skills/ui-design-system/SKILL.md` | Before you choose a component, a token or a layout. Its references hold the Linear rules (FR, LR, IV, SP, IE, FM, SU, TY, KB, CX, PT, ES, TO, MO, FO) and the tokens. A reviewer cites the ID of each rule that a change breaks |
| `.agents/skills/commands/SKILL.md` | Before you add a key, a button that runs an action, or a menu row |
| `.agents/skills/navigation/SKILL.md` | Before you add a route, a link or a prefetch |
| `.agents/skills/porting-upstream/SKILL.md` | Before you pin a file, and when a gate in `tests/map` fails |
| `.agents/skills/react-quality/SKILL.md` | Before you write a component or a test |

## Before the first pull request

1. Read the page's spec: the document of the page's issue in the tracker. It names the regions, the upstream view files of each region, the parity list draft, the parts that each region needs, and the pull requests.
2. Read upstream's view files of the page and their tests. A behaviour that upstream's tests name is a parity item.

## The sequence

One pull request is about 400 changed lines, tests not counted.

1. **The parity list.** The first pull request commits `tests/parity/<page>.md` from the spec's draft, in the format of `tests/parity/machine-login.md`. It has one row for each action, key, URL form, view state (empty, loading, error, a failed refresh), live update, write and write failure. `packages/tl-dispatch/scripts/check-parity.ts` gives the four marks (`changed`, `inside`, `untested`, `After next sync`) and holds the file to the tests.
2. **One region in each pull request.** The pull request that draws the whole region with fork parts marks the region "yes" in the Rebuilt column. That pull request also does each of these:
   - **URL forms.** Each query key and fragment form that the region reads is in the route file's `linkForms`, and a link from before the rebuild opens the same view (`.agents/skills/porting-upstream/SKILL.md`, "The links").
   - **Keys.** Each key is a command of the catalog (`.agents/skills/commands/SKILL.md`). The shared list part registers the commands of Enter, Space and Escape on a list, so they have one meaning on each list: the page does not declare them again.
   - **States.** Each read shows its loading, error and empty states with the `read-boundary` and `states` blocks.
   - **Tests.** Each row of the region has a test whose name starts with its ID.
   - **Accessibility.** The region is in the axe run of `packages/tl-dispatch/e2e/accessibility.e2e.ts`, in light and dark.
   - **Screenshots.** A light and a dark screenshot of each region that the pull request changes.
3. **The deployed run.** Run the browser tests against a deployment of the branch's image, as `packages/tl-dispatch/README.md` says in "The deployed mode". There, click each control of each rebuilt region: a screenshot does not show that a control works.
4. **The review.** See "The review pass".

## The files of a page

```text
src/features/<page>/
  route.tsx        frame options, prefetch, one lazy element. Only src/app imports it. It draws nothing.
  page.tsx         the page's element. Only route.tsx imports it: lazily, unless the layering table's EAGER names it.
  index.ts         only when the shell or another feature uses a small part of the page
  <part>.tsx       one file for each part of the page, with its test beside it
src/data/<resource>.ts            the read and write hooks that the page uses
src/upstream/views/<page>         upstream's page and its regions not yet rebuilt, a file or a folder; the last pull request deletes it
src/upstream/logic/<feature>.ts   upstream's logic that the page needs; only src/data imports it
src/parts/<name>/                 a connected part that two or more features use
```

- A view reads and writes server data only through a hook of `src/data/<resource>.ts`. No view calls `fetch`, refetches, invalidates or polls: the hook sets the refresh.
- Upstream's logic (a hook, a query, the write store) is imported through the seam, never copied.
- A test fakes only the network. A test of a feature never mocks a module of the data layer.

The layering test and the design-rule test hold these rules and the others of the layers. `tests/layers.md` gives the reason of each rule and the questions that place a new file.

## The view map and the copies

The pull request that rebuilds a region adds each upstream view file of the region to `replacedViews` in `src/views.ts`, and pins each of them whole: add the file's entry to `tests/map/copies.json` by hand, as the gate's message says, then run the update command that `.agents/skills/porting-upstream/SKILL.md` gives ("The copies"). Two cases need care:

- A view file that draws two or more regions gets its whole-file pin with the first region that the fork rebuilds from it, and joins `replacedViews` with its last region. An upstream change that touches only a region not yet rebuilt is closed with that reason, and the parity list gets its row.
- When the fork does again a private function of an upstream view file, it pins that function by name. A function local to a component needs a whole-file pin.

## One primary action

Each form that submits, each dialog with an action, and each ask body has exactly one filled button, of variant `default` or `destructive`, and that button shows its key with `Kbd`. Use `PrimaryAction`. Every other button uses another variant. A dialog with no action passes. The test setup calls `expectOnePrimary` before it removes each rendered tree, and the helper fails when one of those surfaces has not exactly one such button.

"Needs you" has one mark and one wording: use `NeedsYouMark` from `src/parts/needs-you`.

## Shared parts

`.agents/skills/ui-design-system/SKILL.md` ("Components: use, change or add") says what a part needs. A connected part that two or more features use goes in `src/parts/<name>/`, and one that only one feature uses stays in that feature's folder. For a page rebuild, two more rules hold:

1. Build a shared part in the pull request of the first page that uses it, so a reviewer sees it on a real page. Add no option, prop or abstraction that no caller uses.
2. A prop name of `packages/ui` holds no domain word: a part takes a kind or a level, not an issue status. The table from the domain value to the props is in one folder, `src/parts/<name>/`.

## The review pass

Before the push that asks for review, run these reviewers, each in a fresh context, with the diff, the page's spec and the skills that it names: a correctness review, an adversarial review, an over-engineering review, a simplification pass, and the two review skills `skills/thermonuclear-deep-review` and `skills/thermonuclear-code-quality`. Each reviewer checks the rules of the design system's references by their IDs.

Each reviewer takes the finding bar of `packages/daemon/internal/prompts/roles/core/reviewer.md`: a prose defect is a false statement, a contradiction, or an instruction that a reader would follow wrongly, and a wording preference is not a finding. A reviewer starts no other reviewer and submits no review, comment or handoff: it reports to you.

Check each verdict or root cause that a reviewer gives before you act on it. The pull request text lists each finding and what you did with it, and each reviewer's verdict line. It also holds a table of light and dark screenshots of each region that it changes, a mermaid diagram of the parts that it adds and how they connect, and the checks that it runs, with links to their CI runs.

## The last pull request of a page

It shows each of these:

- Each region is marked "yes", and no row is `untested` or `After next sync`.
- The route file says that the fork serves the page, and its `views` names each file, with no glob.
- `src/upstream/views/<page>`, its file or folder, is deleted.
- No file of the page is in the layering table's list of breaks.
- `bun run check:entry-budget` passes: the page stays out of the entry chunk.
- For the Inbox: the preview's two commands and its stored choice are removed.

## Checks

In `packages/tl-dispatch`: `bun run test`, `bun run typecheck`, `bun run lint`, `bun run check:parity`, `bun run build` then `bun run check:entry-budget`, `bun tests/map/copies.ts --check-base origin/<base>`, and `bun run test:browser`. In `packages/ui`: `bun run test`, `bun run typecheck` and `bun run lint`. Run the whole suites and the browser tests in CI.
