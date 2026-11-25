# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds | May import |
| --- | --- | --- |
| `src/ui` | The registry's components and theme, as `shadcn add` wrote them: no data, no router | packages and `src/ui` only |
| `src/commands` | The command catalog, compiled to upstream's key engine, and the components that read it | no router and no `src/shell` or `src/pages`: commands take callbacks |
| `src/navigation` | The router: typed links, hooks and the route tree | the only folder that imports `react-router-dom` |
| `src/shell` | The frame every page renders in | anything that does not reach upstream's `app.tsx` or `main.tsx` |
| `src/pages` | One file per page: its named routes, the app that draws it and the upstream views it maps | the same as `src/shell` |
| `src/map` | The checks' readers of the route map, the view map (`src/views.ts`) and the copied upstream code; the app loads none of it | no page module: it reads the sources as text |

`tests/layering.test.ts` holds these rules. It resolves every import as the build does (the
tsconfig paths and the `@upstream-dispatch` alias), follows them through upstream's code, and
refuses an import it cannot resolve or a non-literal `import()`. Upstream's code keeps its own
router imports.

## Registry components

Every file in `src/ui` comes from the shared registry, written by `shadcn add`:

```sh
bunx --bun shadcn@4.23.0 add <path to the registry>/<item>.json
```

They stay as the registry wrote them: `biome.json` neither formats nor lints `src/ui`, and the
design rules skip it. Their lint and tests live in the registry. Fix a registry component there,
then add it again. This app's own tokens are in `src/tokens.css`.

## Theme

`src/ui/theme.css` is a shadcn registry theme item, written by `shadcn add` into the file
`components.json` names. Never edit it by hand. To take a new version of the item, from this
directory:

```sh
bunx --bun shadcn@4.23.0 add <path to the item>/theme-system.json
```

The first line of `theme.css`, `@custom-variant dark (@media (prefers-color-scheme: dark));`, makes
the dark scheme follow the operating system; keep it when the file is written again.

`src/tokens.css` holds this app's own tokens beside the theme:

- `--focus` (`outline-focus`), the focus indicator: `--chart-5` in light, where `--ring` is below
  3:1 on the light surfaces, and `--ring` in dark.
- `--input`, the control border: in each scheme, the least ink mixed into the page that reaches
  3:1 on the page, a card and a muted surface. `--border` keeps the theme's value.

## Commands

`src/commands/catalog.ts` declares every command once: its label, keys, icon, group, whether
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

- `catalog.ts`: the app's commands, the sheet's groups, the sidebar's destinations and the sheet's
  labels for upstream's bindings.
- `schema.ts`: what a command, a context and a catalog are; `createCatalog` checks a catalog.
- `keys.ts`: key text: the checks the catalog runs, and the chips a key shows as.
- `engine.ts`: the bridge to upstream's key engine: its scope stack under our overlays, and the
  bindings a context registers.
- `hooks.ts`: `defineActions`, the command store, `useRegisterCommands` and the hooks that read
  the store.
- `command-button.tsx`, `hotkey-tooltip.tsx` and `shortcuts-sheet.tsx`. The tooltip's popup
  (`hotkey-tooltip-popup.tsx`) and the sheet's view (`shortcuts-sheet-view.tsx`) are files of
  their own because each is a chunk that loads later.

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
- `route-tree.tsx` builds the route tree from the page files, through `routerPath`.

A route also declares its `layout` (`PageLayout` in `page-route.ts`): whether the page fills the
viewport, has the margin and frames itself as the outline issue page, and which issue, project and
live view it shows. Where upstream's parsers decide, the layout is a function of the address.
`useCurrentPage()` returns it with the page, and the shell reads the address only through it.
`route-tree.test.ts` holds every declaration to upstream's route rules.

### Changing the router

A move to another router (TanStack Router, say) changes these files of this package:

- `src/navigation/router-path.ts`: the grammar written in the router's syntax (TanStack: `$name`
  for `:name` and `$` for `*`).
- `src/navigation/provider.tsx`: the router provider, for the app and for tests.
- `src/navigation/route-tree.tsx`: the route tree, its outlet, `pageAt` and `useCurrentPage`.
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

- `use-shell-layout.ts`: `useShellLayout()`, the current page's layout on this viewport with the
  reader's choices (the folded sidebar and margin, the issue page they draw).
- `use-shell-overlays.ts`: `useShellOverlays()`, the navigation drawer, search, a new issue, the
  inbox drawer and the shortcuts sheet, and the global commands that open them.
- `shell-frame.tsx`: the regions: the providers upstream's pages read, the frame, the navigation
  drawer, the sidebar region, main, the margin and the dialogs.
- `sidebar-data.ts` and `sidebar.tsx`: the sidebar's rows, then their view.
- `auth-gate.tsx`: the sign-in check before the shell: a skeleton, the sign-in page, a
  connection error, or the shell for the person signed in.

## Install

The app is outside the root workspaces. It takes React and the other libraries upstream's web app
also loads from the root install (`rootPackages` in `package.json`), so each has one copy:

```sh
bun install            # at the repository root
bun install            # in this directory; it links the root packages
```

## Route map, view map and copied code

`src/map` holds three checks on what upstream changes:

- `links.ts`: the app serves every route of upstream's `app.tsx`, drawing upstream's element as
  written. `OWN_ELEMENTS` names each route written with this app's own part and upstream's
  element it stands for. A page this app serves reads every query key and fragment Dispatch writes.
- `coverage.ts`: every view file under upstream's `features/` has one owner: a page's `views`, or
  a list in `src/views.ts`.
- `copies.ts`: `copies.json` pins each part of upstream's code this app copied, by hash. When
  upstream changes one, port the change, then run `bun src/map/copies.ts --update`.

## Checks

- `bun run test`: the layers, the design rules, the contrast of every text pair, of focus and of
  control borders, the catalog and its components, navigation, the shell's hooks, the key
  engine's behaviour the catalog relies on, and the route map, the view map and the copied code.
  The design rules compile the app's own classes with Tailwind and check the CSS they emit.
  `tests/design-config.ts` lists the only files they leave out.
- `bun run build && bun run check:entry-budget`: the entry chunk stays within its budget. The
  shortcuts sheet and the tooltips are their own chunks for it.
- `bun run typecheck`, `bun run lint`.

The `tl-dispatch` job of `.github/workflows/fork-checks.yaml` runs all of them.
