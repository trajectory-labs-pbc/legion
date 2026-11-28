# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds |
| --- | --- |
| `src/upstream` | The seam: the one folder that imports upstream's code, one file for each subject, each a re-export by name, besides `mark.tsx` and the side-effect `write-kinds.ts`; each component a `views/` or `widgets/` file gives draws inside the mark, or is a name `UNMARKED` lists; `tests/upstream.ts` is the tests' door to upstream's test helpers |
| `src/commands` | The command catalog, compiled to upstream's key engine, and the components that read it |
| `src/navigation` | The router: each page's addresses (`routes.ts`), typed links, hooks and the route tree |
| `src/loading` | The chunk loaders, and the skeleton a page shows while it loads |
| `src/browser` | Upstream's storage keys, read and written in upstream's names and formats (`storage.ts`), and the unload prompt (`unload.ts`) |
| `src/stores` | What the fork keeps in the browser: one Zustand store for each concern, each with Zustand's `persist` under the fork's prefix, its version and its actions (`ui-preferences.ts`: what a person sets in the UI); with `storage.ts`, the only files that touch the browser's storage |
| `src/data` | The hooks through which a view reads and writes Dispatch's data, the signed-in person (`session.ts`, the one file that reads it) and what a surface says of a failed read (`read-failure`, the alert with its Retry) or write; only it and the seam reach the network |
| `src/shell` | The frame every page renders in |
| `src/app` | The composition root: the route map (`routes.ts`), the app's providers and the start; only `src/main.tsx` and the tests import it |
| `src/parts` | The connected parts several pages and the shell share: `needs-you`, the one mark for what waits on the reader; only `needs-you` imports `@legion/ui/components/attention-mark` (`tests/needs-you.test.ts`) |
| `src/features` | Each page's folder, with its route file (`route.tsx`) and, where this app draws the page, its `page.tsx` |

`tests/layers.table.ts` holds the layers and their rules as data, with the list of the imports
that break a rule today, and `tests/layers.md` gives the reason for each rule and the questions
that place a new file, so they say what each folder may import. `tests/layering.test.ts`
checks each import of the app and of its tests against the table. It resolves every import as the build does (the tsconfig paths and the
`@upstream-dispatch` alias), follows them through upstream's code, and refuses an
import it cannot resolve or a non-literal `import()`. Upstream's code keeps its own router
imports. No file of the app imports `@base-ui/react`: Base UI comes through `packages/ui`.

## Components and theme

The components, the tokens and the typeface are `packages/ui` (`@legion/ui`), imported from its
sources:

```tsx
import { Button } from "@legion/ui/components/button";
import { cn } from "@legion/ui/lib/utils";
```

- `tsconfig.json` and `vite.config.ts` point `@legion/ui/components`, `@legion/ui/blocks` and
  `@legion/ui/lib` at `packages/ui/src`. A block is a part with words of its own, such as the
  shortcuts sheet. `src/styles.css` imports the package's `theme.css` after upstream's stylesheet: the tokens
  and the typeface, and not the package's Tailwind entry, dark variant or base rules, which
  would recompile or recolour upstream's pages.
- The package's components import `@base-ui/react`, `class-variance-authority`, `cn` and
  `lucide-react` (`uiPackages` in `package.json`). Both packages install them, so the build takes
  this app's copy of each (`resolve.dedupe`), and `scripts/one-copy-each.ts` fails a build that
  holds two copies or the package's own.
- A component the app needs and the package lacks is added to the package, with its test and
  its registry entry. Never copy one here.
- `src/tokens.css` holds the two rules the app adds: the theme's typeface on `:root`, which
  upstream's stylesheet would otherwise set, and the package's edge and focus colours on its
  parts (`[data-slot]`), which its base rules would otherwise give.
- `src/repaint.css` maps the Tailwind shades and the literal colours upstream's pages use onto
  the theme's tokens, so those pages take the theme with no edit to them.
  `tests/repaint.test.ts` checks it. The file lasts while the app shows upstream's pages.
- `src/frame.css` overrides the upstream rules that break the frame (the 44 px floor in the
  navigation, the margin sheet and borderless fields in the content panel). It goes with them.

## Commands

`src/commands/app-catalog.ts` declares every command once: its label, keys, icon, group, whether
it is destructive and the lists it stays out of. Its global context holds the keys upstream's shell
binds, and adds the pages with no letter as palette commands. Those keys run as upstream's do,
with one difference: an open overlay of this app (a dialog, or a menu or popover that holds the
focus) stops them, unless the overlay lets them through. The catalog refuses, when it loads, two
keys live together that one press matches or where one starts the other, as upstream's key engine
matches them. `CommandId` is typed from it, so a misspelt id fails `tsc`.

A feature gives each command of a context its live state with `defineActions`, whose type check
refuses a missing or unknown command name, and `useRegisterCommands` registers them with the key
engine and the command store. Everything else reads the store:

- `useCommand(id)` and `useCommandShortcut(id)`: the command, and its key as display chips, one
  per key (`⌘` `K` on a Mac, `Ctrl` `K` elsewhere). No chip shows while the command is off or an
  open overlay stops its key. `commandStore.run(id)` runs a mounted command through its gate, as
  its key does.
- `CommandButton` and `HotkeyTooltip`: the label, icon, style and key come from the catalog, and a
  click runs what the key runs. A disabled command hides its button unless `showIfDisabled`. The
  tooltip's code loads after the first paint; until then the control carries its keys alone.
- `ShortcutsSheet`: `?` opens it anywhere but under an alert dialog or one of upstream's dialogs,
  and its code loads then. It lists each key live where `?` was pressed, grouped, each command
  once with all its keys, without `Escape` or disabled commands. While it is open, only `?` and
  Escape act: they close it.

The files of `src/commands`, one role each:

- `app-catalog.ts`: the app's commands (`APP_CONTEXTS`, `appCatalog`, `CommandId`).
- `groups.ts`: the sheet's groups. `destinations.ts`: the sidebar's destinations, their routes and
  their `G` chords.
  `upstream-labels.ts`: the sheet's labels for upstream's bindings.
- `schema.ts`: what a command, a context and a catalog are; `createCatalog` checks a catalog.
- `keys.ts`: the checks the catalog runs on a key. `key-chips.ts`: the chips a key shows as.
- `focused-overlay.ts`: the overlays over the page, read from the DOM in the order the page
  stacks them: each open modal one, then each other one the focus is inside. `engine-stack.ts`: upstream's key engine's scope stack under
  them. `bindings.ts`: the bindings a context registers with it.
- `actions.ts`: `defineActions`. `command-store.ts`: the mounted commands.
  `use-register-commands.ts` and `use-command.ts`: the hooks that register and read them.
- `live-shortcuts.ts`: the keys that run now, as rows. `use-shortcuts-sheet.ts`: the sheet's
  state. `shortcuts-sheet.tsx`: the sheet, whose view (`shortcuts-sheet-view.tsx`) is a chunk
  that loads on the first `?`: it writes each key as chips and draws the UI package's sheet.
- `command-button.tsx` and `hotkey-tooltip.tsx`, whose popup (`hotkey-tooltip-popup.tsx`) is a
  chunk that loads after the first paint. `use-kept-focus.ts` keeps the focus on the control
  when the popup's code arrives and the control is drawn again.

`src/loading` holds the chunk loaders: `lazyNamed(load, name)` draws a module's component once
its chunk arrives, `lazyRegion` keeps a failed chunk to its own region, and both load again when
the network returns.

## Navigation

`src/navigation/routes.ts` names each page's addresses with `routePath`, which keeps the path
and search keys as literal types, and each route file (`src/features/<page>/route.tsx`) puts the
page's lazy element on them with `pageRoute`. Paths are written in navigation's own grammar, which `src/navigation/path.ts`
alone reads: `/`-separated text, a `:name` param and a last `*` for the rest of the address.
`src/navigation` builds everything else from them:

- `pageHref(route, params?, search?)`, `<PageLink page params? search>`, `<Redirect>`,
  `usePageNavigate()`, `usePageParams(route)`, `usePageSearch(route)` and `useCurrentRoute()`, each
  typed from the route's path. `params` is required only where the path binds a `:name`.
- `<PageLink>` starts the `prefetch` reads of the route its address opens in the app's route
  tree when the pointer rests on it for 100 ms or it takes focus. The pointer leaving before then starts nothing. A read that started runs to its
  answer, since upstream's reads cannot be stopped and the page that opens uses it.
- `route-tree.tsx` builds a route tree from the pages it is handed, through `routerPath`.

A route also declares its `layout`, whose type is the app's: navigation carries it and reads none
of it. `PageLayout` in `src/shell/page-layout.ts` says whether the page fills the viewport, has the
margin and frames itself as the outline issue page, and which issue, project and live view it
shows. Where upstream's parsers decide, the layout is a function of the address.

`src/navigation/route-tree.tsx` holds the app's one route tree: `RouteProvider`, the outlet
(`PageRoutes`) and `useCurrentRoute<Layout>()`. The shell binds `PageLayout` to it in
`src/shell/page-layout.ts`. `src/app/routes.ts` lists the pages, and the app's providers hand
them to `RouteProvider`. The shell reads the address only through the layout
`useCurrentRoute()` returns. `src/app/routes.test.tsx` holds every declaration to upstream's
route rules. A route file ends `satisfies AppPage<typeof routes.<id>>`, so tsc fails a page that
misses, adds or moves a route of the addresses `src/navigation/routes.ts` gives its links.

### Changing the router

A move to another router (TanStack Router, say) changes these files of this package:

- `src/navigation/router-path.ts`: the grammar written in the router's syntax (TanStack: `$name`
  for `:name` and `$` for `*`).
- `src/navigation/provider.tsx`: the router provider. `tests/navigation.tsx`: the one tests use.
- `src/navigation/route-tree.tsx`: `createRouteTree`, `RouteProvider`, the outlet, `pageAt` and
  `useCurrentRoute`.
  Each route's `element` becomes the new router's component there.
- `src/navigation/page-link.tsx`: `PageLink`, `Redirect` and the prefetch on intent.
- `src/navigation/hooks.ts`: `usePageNavigate`, `usePageParams`, `usePageSearch` and `useAddress`.
- `package.json` and the lockfile: the dependency.
- `vite.config.ts`: its `dedupe` list names `react-router-dom`.
- The tests under `src/navigation` that call the router (`hooks.test.tsx` reads
  `useNavigationType`).

The route files, `page-route.ts`, `path.ts`, the shell and `tests/layering.ts` (whose rule names
both routers) stay as they are.

That holds for this package only. More than a hundred of upstream's files import React Router,
and the upstream pages drawn here load them, themselves or through the files they import, so until
the last of those pages is replaced the app must keep a React Router context around them. Before
then, a swap means running both routers.

## Shell

`src/shell/app-shell.tsx` only composes the frame around every page. Its parts:

- `use-shell-layout.ts`: `useShellLayout()`, the current page's layout on this viewport, with
  the reader's choices from `use-shell-preferences.ts` (the folded sidebar and margin).
- `use-shell-overlays.ts`: `useShellOverlays()`, the navigation drawer, search, a new issue, the
  inbox drawer and the shortcuts sheet, and the global commands that open them
  (`global-commands.ts`).
- One file per region: `shell-providers.tsx` (the providers upstream's pages read),
  `shell-frame.tsx`, `navigation-drawer.tsx`, `sidebar-region.tsx`, `content-panel.tsx` (the
  card main and the margin sit in), `main-region.tsx`, `margin-region.tsx`, `shell-dialogs.tsx`
  and `shell-background.tsx` (the parts that draw nothing of their own until they open). Each
  takes the values it reads. The navigation
  drawer is the UI package's sheet from the left (`navigation-drawer-view.tsx`), a chunk that
  loads when it first opens; the global keys still run in it.
- `sidebar-data.ts` and `sidebar.tsx`: the sidebar's rows, from the reads of
  `src/data/sidebar.ts`, then their view.
- `auth-gate.tsx`: the sign-in check before the shell, from `src/data/session.ts` and
  `src/data/sign-ins.ts`: `shell-skeleton.tsx`, `sign-in-page.tsx`,
  `connection-error-page.tsx`, or the shell for the person signed in, inside
  `signed-in-parts.tsx` (the keys, the agent registry's poller and the ask card).
- `page-fallbacks.tsx`: what main shows while a page's code loads.

## Install

The app is outside the root workspaces. It takes React and the other libraries upstream's web app
also loads from the root install (`rootPackages` in `package.json`), so each has one copy, and
it imports `packages/ui` from source, so that package is installed too:

```sh
bun install            # at the repository root
bun install            # in packages/ui
bun install            # in this directory; packages/ui's script links the root packages
```

## Image

`docker/Dockerfile` builds the image the fork deploys: upstream's envoy image, unchanged, with this
app's build at `/srv/tl-dispatch`. `DISPATCH_WEB_DIST` chooses the app the server serves, and its
default is upstream's app, `/srv/dispatch-web`. `docker/envoy-dispatch.sh` starts the server and
refuses to start it on a folder with no build.

## Route map, view map and copied code

`tests/map` holds three checks on what upstream changes. They read upstream's sources as text;
`links.ts` and `coverage.ts` also load this app's route map:

- `links.ts`: the app serves every route of upstream's `app.tsx`, drawing upstream's element as
  written. `OWN_ELEMENTS` names each route written with this app's own part and upstream's
  element it stands for. A page this app serves reads every query key and fragment Dispatch writes.
- `coverage.ts`: maps each view file under upstream's `features/` to its owner: a page's `views`,
  or a list in `src/views.ts`. It fails for a file two lists name and for what upstream changed on
  a page this app serves; a file no owner loads, or a change on a page upstream draws, prints a note.
- `copies.ts`: `copies.json` pins each part of upstream's code this app copied, by hash, and
  each upstream view file in `replacedViews` of `src/views.ts` whole. When upstream changes one,
  port the change or close it, then run
  `bun tests/map/copies.ts --update <upstream file> <part> --outcome ported|closed --reason <why>`,
  which pins that part and no other. A pin changed since the merge base needs its outcome and reason.

## Checks

- `bun run test`: the layers, the design rules, the catalog and its components, navigation, the shell's hooks, the key
  engine's behaviour the catalog relies on, and the route map, the view map and the copied code.
  `e2e/route-marks.test.ts` fails on a route of the route map with no mark in `e2e/route-marks.ts`,
  and on a mark with no route.
  The design rules compile the app's own classes with Tailwind and check the CSS they emit.
  Among them: nothing scales and no class sets the pointer cursor. The contrast of the tokens is
  checked in `packages/ui`.
  `tests/upstream-classes.test.ts` fails, naming the class and its file, when a class of
  upstream's sources that upstream's stylesheet compiles has no rule in the app's CSS.
  `tests/skill-paths.test.ts` fails on a path that one of the fork's skills under `.agents/skills`
  or this package's `AGENTS.md` names in an inline code span and that does not exist, read from
  the roots `AGENTS.md` ("Paths") gives: a path, a file name, or a path among the words of a
  command. It reads no fenced block, no glob and no path with a placeholder such as `<page>`.
  The tests run under upstream's own preloads (`bunfig.toml`), so a test that updates React
  outside `act`, or sends a request nothing answers, fails.
  `tests/design-config.ts` lists the only files they leave out.
- `bun run check:parity`: `scripts/check-parity.ts` holds each parity list in `tests/parity` to the
  test names. Each list has a `Region | Rebuilt` table and an `ID | Region | Item | Mark | Note`
  table. A row of a rebuilt region needs a test whose name starts with its ID, and a test whose
  name starts with an ID needs a row. A row marked `changed` gives its reason in Note; a row
  marked `After next sync` gives upstream's commit, and fails once that commit is in this branch;
  a row marked `inside` gives the full name of upstream's test that covers it; a row marked
  `untested` gives in Note why it has no test yet, and fails the check once a test names it, until
  the mark goes. The script reads the titles of the `test`, `it` and `.each` calls of the `.test` and
  `.e2e` files under `src`, `tests`, `scripts` and `e2e`, and a title that starts with a loop's or
  a `.each` table's first value gives one name for each row.
- `bun run build && bun run check:entry-budget`: the entry chunk, with the chunks the page preloads beside it, stays within its budget. The
  shortcuts sheet and the tooltips are their own chunks for it.
- `bun run build && bun run check:entry-modules`: no page loads before first paint, neither a
  feature's file other than its route file nor an upstream view, except the modules `EAGER` in
  `tests/layers.table.ts` names, and each of those does. It reads `.build/entry-modules.json`, which the build writes.
- `bun run typecheck`, `bun run lint`.
- `bun run test:browser`: the browser tests (`e2e/*.e2e.ts`) in the local mode. Upstream's
  harness (`packages/dispatch/e2e`) starts a Go server on this app's `dist` (`e2e/server.ts`),
  a Postgres and its fakes, and each test starts from an emptied database and a context signed
  in at dev sign-in. It builds the contracts and this app first, and needs Go,
  `bunx playwright install chromium`, and a Postgres: `DISPATCH_E2E_PG_IMAGE` (an image with
  `vector`, run by Docker) or `DISPATCH_E2E_PG_BIN`. It refuses to start while `DATABASE_URL` is
  set, because upstream's harness would empty that database, unless `DISPATCH_E2E_REUSE_SERVERS=1`
  reuses a stack upstream's `harness-up.ts` started, or `E2E_LOCAL_DATABASE=throwaway` says the
  database may be emptied (a Postgres you started with its CPU and memory capped, for example).
  It leaves out `*.multiprocess.e2e.ts`, as upstream's default run does.
  `e2e/routes.e2e.ts` opens each route of the route map in both modes, and fails on a route
  whose mark, a heading, a labelled region or a text only that route's page shows, does not
  show, on a route that lands on another address or misses a read its row names, and on a
  console error. `e2e/route-marks.ts` names the mark of each route; its header
  names what each mode seeds for each route, and the mark the deployed mode expects where it
  seeds nothing.
  The exit flows, one file each and in both modes: a sign-in reaches a tab on the sign-in page
  (`sign-in-tab`), a change through the API shows on an open page (`live-event`), a write held in
  the browser stays after a reload (`unsent-write`), and a sign-out with an unsent change asks
  first (`sign-out-asks`; only the local mode confirms it). The first two pages change with no
  reload by the test.
  `e2e/accessibility.e2e.ts`, in the local mode only, runs axe at WCAG 2.0 and 2.1 A and AA on
  each region the app draws, in light and in dark, and leaves out upstream's widgets and pages.
- `bun run test:browser:deployed-local`: the deployed mode once, against a local stack that
  `e2e/local-stack.ts` starts as the local mode does and whose URL it prints, with a dev
  sign-in's storage state and an agent token with no scope.
- `bun run test:browser:switch`: `e2e/switch.multiprocess.e2e.ts` alone, in upstream's two-process
  mode: Dispatch A serves this app and Dispatch B upstream's build under one origin. The file's
  header says what it checks. It runs on the builds `bun run test:browser` made, and needs
  upstream's web dist (`bun run build:web` in `packages/dispatch`). Its results go to
  `e2e/test-results/switch`.

The `tl-dispatch` job of `.github/workflows/fork-checks.yaml` runs all of them.

### The deployed mode

`bun run test:browser:deployed` runs the same browser tests against a Dispatch this run did not
start. It reads three settings from the shell: `PLAYWRIGHT_BASE_URL`, `E2E_AGENT_TOKEN` (an agent
token of that Dispatch) and `E2E_STORAGE_STATE` (a Playwright storage-state file that holds a
`dsession` cookie for that host). It starts no server and empties no database: it refuses to
start while `DATABASE_URL` or `DISPATCH_E2E_STACKS` is set, and refuses a test that sets
`signedIn`. A deployed Dispatch serves no dev sign-in, and a sign-out would end every session of
the signed-in person, so two paths refuse them: the worker's `fetch`, which upstream's seed
helpers call, refuses dev sign-in (a seed `as: "user"`) and `/auth/logout`, and each context the
`test` gives aborts the browser's `/auth/logout` (`e2e/deployed-guards.e2e.ts`). Neither reaches
`page.request` or `context.request`, so a deployed-mode test sends nothing through them, and a
test that needs a context of its own takes the `emptyContext` fixture, which aborts it too.
Each context starts from the storage state's cookies alone, so a test reads each app's default
preferences, whatever the person's browser keeps, and nothing it sets reaches that browser. A
seed goes `as: "agent"`.

`E2E_PHASE` chooses the files: `routes-and-flows`, the default, runs every file but
`*.multiprocess.e2e.ts` and `accessibility.e2e.ts`; `switch-to-upstream` and `switch-to-new`
run `switch.multiprocess.e2e.ts` alone, across a deploy to the app the phase names, and wait for
the file `E2E_SWITCH_SIGNAL` names, which the operator writes once the deploy has finished; a
switch phase refuses to start without it. The file's header gives the procedure. The deployed
config takes no trace, which would hold the session cookie.
Each record a run makes carries the run's name,
`E2E_RUN_NAME` (a project key; the run picks one when it is not set), and a test reads only
records it made. `e2e/modes.ts` holds these rules. The route test ends the priority it made and
retracts its open ask, in both modes, and leaves its project, issue, document and session file.
The flow tests leave an issue each in the run's project: the live-event test's has its title
changed, the unsent-write test's has its status set to todo, and the sign-out and switch tests'
are as they were made, since their write never reaches Dispatch.
