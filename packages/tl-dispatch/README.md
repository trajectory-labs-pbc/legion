# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds | May import |
| --- | --- | --- |
| `src/commands` | The command catalog, compiled to upstream's key engine, and the components that read it | no router and no `src/shell` or `src/pages`: commands take callbacks |
| `src/navigation` | The router: typed links, hooks and the route tree | the only folder that imports `react-router-dom`; no page and no shell |
| `src/loading` | The chunk loaders | upstream's offline retry and error boundary |
| `src/writes` | What a surface says of a failed write | upstream's write modules |
| `src/shell` | The frame every page renders in | anything that does not reach upstream's `app.tsx` or `main.tsx` |
| `src/pages` | One file per page: its named routes, the app that draws it and the upstream views it maps. A page this app serves keeps its parts in a folder of its name | the same as `src/shell` |

`tests/layering.test.ts` holds these rules. It resolves every import as the build does (the
tsconfig paths and the `@upstream-dispatch` alias), follows them through upstream's code, and
refuses an import it cannot resolve or a non-literal `import()`. Upstream's code keeps its own
router imports. No file of the app imports `@base-ui/react`: Base UI comes through `packages/ui`.

## Components and theme

The components, the tokens and the typeface are `packages/ui` (`@legion/ui`), imported from its
sources:

```tsx
import { Button } from "@legion/ui/components/button";
import { cn } from "@legion/ui/lib/utils";
```

- `tsconfig.json` and `vite.config.ts` point `@legion/ui/components`, `@legion/ui/blocks` and
  `@legion/ui/lib` at `packages/ui/src`. A block is a part with words of its own, such as the
  shortcuts sheet. `src/styles.css` imports the package's stylesheet after upstream's.
- The package's components import `@base-ui/react`, `class-variance-authority`, `cn` and
  `lucide-react` (`uiPackages` in `package.json`). Both packages install them, so the build takes
  this app's copy of each (`resolve.dedupe`), and `scripts/one-copy-each.ts` fails a build that
  holds two copies or the package's own.
- A component the app needs and the package lacks is added to the package, with its test and
  its registry entry. Never copy one here.
- `src/tokens.css` holds the two rules the app adds: the theme's typeface on `:root`, which
  upstream's stylesheet would otherwise set, and upstream's canvas under upstream's pages.

## Commands

`src/commands/app-catalog.ts` declares every command once: its label, keys, icon, group, whether
it is destructive and the lists it stays out of. Its global context holds the keys upstream's shell
binds, with the same behaviour, and adds the pages with no letter as palette commands. The catalog refuses,
when it loads, two keys live together that one press sequence matches or where one starts the
other, as upstream's key engine compares them. `CommandId` is typed from it, so a misspelt id
fails `tsc`.

A feature gives each command of a context its live state with `defineActions`, whose type check
refuses a missing or unknown command name, and `useRegisterCommands` registers them with the key
engine and the command store. Everything else reads the store:

- `useCommand(id)` and `useCommandShortcut(id)`: the command, and its key as display chips (`⌘K`
  on a Mac, `Ctrl+K` elsewhere). No chip shows while the command is off or an open overlay stops
  its key. `commandStore.run(id)` runs a mounted command through its gate, as its key does.
- `CommandButton` and `HotkeyTooltip`: the label, icon, style and key come from the catalog, and a
  click runs what the key runs. A disabled command hides its button unless `showIfDisabled`. The
  tooltip's code loads after the first paint; until then the control carries its keys alone.
- `ShortcutsSheet`: `?` opens it anywhere but under an alert dialog, and its code loads then. It
  lists each key live where `?` was pressed, grouped, each command once with all its keys, without
  `Escape` or disabled commands. While it is open, only `?` and Escape act: they close it.

The files of `src/commands`, one role each:

- `app-catalog.ts`: the app's commands (`APP_CONTEXTS`, `appCatalog`, `CommandId`).
- `groups.ts`: the sheet's groups. `nav.ts`: the sidebar's destinations and their `G` chords.
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

Each page file names its routes with `pageRoute`, which keeps the path and search keys as
literal types. Paths are written in navigation's own grammar, which `src/navigation/path.ts`
alone reads: `/`-separated text, a `:name` param and a last `*` for the rest of the address.
`src/navigation` builds everything else from them:

- `pageHref(route, params?, search?)`, `<PageLink page params? search>`, `<Redirect>`,
  `usePageNavigate()`, `usePageParams(route)`, `usePageSearch(route)` and `useCurrentPage()`, each
  typed from the route's path. `params` is required only where the path binds a `:name`.
- `<PageLink>` starts the route's `prefetch` reads when the pointer rests on it for 100 ms or it
  takes focus. The pointer leaving with no click stops a read nothing else watches; losing focus
  and a click stop nothing, since the page that opens reads it.
- `route-tree.tsx` builds a route tree from the pages it is handed, through `routerPath`.

A route also declares its `layout`, whose type is the app's: navigation carries it and reads none
of it. `PageLayout` in `src/pages/page.ts` says whether the page fills the viewport, has the
margin and frames itself as the outline issue page, and which issue, project and live view it
shows. Where upstream's parsers decide, the layout is a function of the address.

`src/pages/index.ts` lists the pages and hands them to `createRouteTree`, which gives the outlet
(`PageRoutes`), `pageAt` and `useCurrentPage()`. The shell reads the address only through the
layout `useCurrentPage()` returns. `src/pages/index.test.ts` holds every declaration to upstream's
route rules.

### Changing the router

A move to another router (TanStack Router, say) changes these files of this package:

- `src/navigation/router-path.ts`: the grammar written in the router's syntax (TanStack: `$name`
  for `:name` and `$` for `*`).
- `src/navigation/provider.tsx`: the router provider. `tests/navigation.tsx`: the one tests use.
- `src/navigation/route-tree.tsx`: `createRouteTree`: the outlet, `pageAt` and `useCurrentPage`.
  Each route's `element` becomes the new router's component there.
- `src/navigation/page-link.tsx`: `PageLink`, `Redirect` and the prefetch on intent.
- `src/navigation/hooks.ts`: `usePageNavigate`, `usePageParams`, `usePageSearch` and `useAddress`.
- `package.json` and the lockfile: the dependency.
- `vite.config.ts`: its `dedupe` list names `react-router-dom`.
- The tests under `src/navigation` that call the router (`hooks.test.tsx` reads
  `useNavigationType`).

The page files, `page-route.ts`, `path.ts`, the shell and `tests/layering.ts` (whose rule names
both routers) stay as they are.

That holds for this package only. 111 of upstream's files import React Router, and every upstream
page drawn here is one of them, so until the last of those pages is replaced the app must keep a
React Router context around them. Before then, a swap means running both routers.

## Shell

`src/shell/app-shell.tsx` only composes the frame around every page. Its parts:

- `use-shell-layout.ts`: `useShellLayout()`, the current page's layout on this viewport, with
  the reader's choices from `use-shell-preferences.ts` (the folded sidebar and margin).
- `use-shell-overlays.ts`: `useShellOverlays()`, the navigation drawer, search, a new issue, the
  inbox drawer and the shortcuts sheet, and the global commands that open them
  (`global-commands.ts`).
- One file per region: `shell-providers.tsx` (the providers upstream's pages read),
  `shell-frame.tsx`, `navigation-drawer.tsx`, `sidebar-region.tsx`, `main-region.tsx`,
  `margin-region.tsx` and `shell-dialogs.tsx`. Each takes the values it reads. The navigation
  drawer is the UI package's sheet from the left (`navigation-drawer-view.tsx`), a chunk that
  loads when it first opens; the global keys still run in it.
- `sidebar-data.ts` and `sidebar.tsx`: the sidebar's rows, then their view.
- `auth-gate.tsx`: the sign-in check before the shell: `shell-skeleton.tsx`, `sign-in-page.tsx`,
  `connection-error-page.tsx`, or the shell for the person signed in.
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

## Route map, view map and copied code

`tests/map` holds three checks on what upstream changes. They read the sources as text and
load no page module:

- `links.ts`: the app serves every route of upstream's `app.tsx`, drawing upstream's element as
  written. `OWN_ELEMENTS` names each route written with this app's own part and upstream's
  element it stands for. A page this app serves reads every query key and fragment Dispatch writes.
- `coverage.ts`: every view file under upstream's `features/` has one owner: a page's `views`, or
  a list in `src/views.ts`.
- `copies.ts`: `copies.json` pins each part of upstream's code this app copied, by hash. When
  upstream changes one, port the change, then run `bun tests/map/copies.ts --update`.

## Checks

- `bun run test`: the layers, the design rules, the catalog and its components, navigation, the shell's hooks, the key
  engine's behaviour the catalog relies on, and the route map, the view map and the copied code.
  The design rules compile the app's own classes with Tailwind and check the CSS they emit.
  Among them: nothing scales and no class sets the pointer cursor. The contrast of the tokens is
  checked in `packages/ui`.
  `tests/skill-paths.test.ts` fails on a path that a skill under `.agents/skills` or this
  package's `AGENTS.md` names and that does not exist.
  The tests run under upstream's own preloads (`bunfig.toml`), so a test that updates React
  outside `act`, or sends a request nothing answers, fails.
  `tests/design-config.ts` lists the only files they leave out.
- `bun run build && bun run check:entry-budget`: the entry chunk stays within its budget. The
  shortcuts sheet and the tooltips are their own chunks for it.
- `bun run typecheck`, `bun run lint`.

The `tl-dispatch` job of `.github/workflows/fork-checks.yaml` runs all of them.
