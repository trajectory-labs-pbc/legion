# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds | May import |
| --- | --- | --- |
| `src/navigation` | The router: typed links, hooks and the route tree | the only folder that imports `react-router-dom`; no page and no shell |
| `src/loading` | The chunk loaders | upstream's offline retry and error boundary |

`tests/layering.test.ts` holds the router rules of `src/navigation`; what `src/loading` imports
is a convention. The test resolves every import as the build does (the tsconfig paths and the `@upstream-dispatch` alias), follows them through upstream's code, and
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
  takes focus. The pointer leaving before then starts nothing. A read that started runs to its
  answer, since upstream's reads cannot be stopped and the page that opens uses it.
- `route-tree.tsx` builds a route tree from the pages it is handed, through `routerPath`.

## Install

The app is outside the root workspaces. It takes React and the other libraries upstream's web app
also loads from the root install (`rootPackages` in `package.json`), so each has one copy, and
it imports `packages/ui` from source, so that package is installed too:

```sh
bun install            # at the repository root
bun install            # in packages/ui
bun install            # in this directory; packages/ui's script links the root packages
```

## Checks

- `bun run test`: the layers, the design rules and navigation.
  The design rules compile the app's own classes with Tailwind and check the CSS they emit.
  Among them: nothing scales and no class sets the pointer cursor. The contrast of the tokens is
  checked in `packages/ui`.
  The tests run under upstream's own preloads (`bunfig.toml`), so a test that updates React
  outside `act`, or sends a request nothing answers, fails.
  `tests/design-config.ts` lists the only files they leave out.
- `bun run typecheck`, `bun run lint`.

The `tl-dispatch` job of `.github/workflows/fork-checks.yaml` runs all of them.
