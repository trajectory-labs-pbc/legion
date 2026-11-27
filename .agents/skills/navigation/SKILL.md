---
name: navigation
description: "Use when you add a page or a route to packages/tl-dispatch, write a link or a page move, read a URL param or search key, or are about to import react-router-dom: route files, PageLink, the navigation hooks and the router rule."
---

# Navigation in tl-dispatch

Every address of the app is declared in `src/navigation/routes.ts`, and each route file puts its page on those addresses. Links and moves are typed from those declarations. The code is in `packages/tl-dispatch/src/navigation`.

## The rules

1. Only `src/navigation` and `src/app` import the router (`react-router-dom`, or any `@tanstack/*router*`). `tests/layering.test.ts` refuses the import in any other file of the app; a test may import it to draw a page. Upstream's own files keep their router imports.
2. Never write a path as a string. Link with `PageLink`, move with `usePageNavigate`, and build a string address with `pageHref` only where an API needs a string.
3. A command never navigates by itself. It takes a callback (`goTo`), and the shell wires the callback to `usePageNavigate`. See `.agents/skills/commands/SKILL.md`.
4. The URL is the state a reader reloads into or shares: the page, its tab, its filters, its selection, its peek and an open create form. Keep that state in the path or the search keys, not in component state.
5. A filter or a view change replaces the history entry. A new destination pushes one.
6. Every URL form upstream's app accepts still opens the same page. The link test in `tests/map/links.test.ts` checks it.

## Why only two folders import the router

The app keeps React Router while it still draws upstream's pages, because each of them reads React Router's hooks. A later move to another router must change `src/navigation` and the few files the README lists, not every page. `packages/tl-dispatch/README.md` ("Changing the router") lists every file a move changes and the files that stay. Tests wrap a page in `MemoryNavigationProvider` from `tests/navigation.tsx`.

## Route files

Each page has a route file, `src/features/<page>/route.tsx`, and its addresses are in `src/navigation/routes.ts`. The route file exports a page that `satisfies AppPage<typeof routes.<page>>` (`src/shell/page-layout.ts`), so `tsc` fails a page that misses, adds or moves one of its addresses:

| Field | Meaning |
| --- | --- |
| `id` | The page's name. |
| `server` | `"upstream"` while the app draws upstream's page; `"fork"` once this app draws its own. |
| `routes` | Named routes, each written with `pageRoute`. A link names the route it opens. |
| `views` | The upstream view files the page replaces, as paths under `packages/dispatch/web/src`. See `.agents/skills/porting-upstream/SKILL.md`. |

An address is `routePath({ path, search? })` in `src/navigation/routes.ts`, under the page's id and the route's name:

- `path` uses navigation's grammar, which only `path.ts` reads: `/`-separated text, a `:name` segment for a param, and a last `*` for the rest of the address. `"/issues/:key/*"` binds `key`.
- `search` lists the search keys the page reads, as literals.

`routePath` keeps the path and search keys as literal types, so every link to the address is typed. A link names the address, so the shell and a feature link to a page without its route file.

A route is `pageRoute({ ...routes.<page>.<name>, element, prefetch?, layout? })`:

- `element` is the page, loaded lazily with `lazyNamed`: a route file imports its `page.tsx` and upstream's views only with `import()`, and draws nothing itself. The Inbox (the home page), the machine login page and the not-found page are the exceptions: `EAGER` in `tests/layers.table.ts` names the modules that load before first paint.
- `prefetch(params)` returns the page's first reads, each `prefetchOf(queryOptions)` from `src/data/prefetch.ts`.
- `layout` says how the shell frames the page: a `PageLayout` (`src/shell/page-layout.ts`), or a function of the address.

## Add a page or a route

1. Add each address to `routes` in `src/navigation/routes.ts`.
2. Write or extend the route file `src/features/<page>/route.tsx`, with a `pageRoute` for each address. A page the fork draws goes in `page.tsx` beside it.
3. Add the page to `routeFiles` in `src/app/routes.ts`, the route map. Only `src/app` imports a route file: `tests/layering.test.ts` refuses any other importer.
4. If the sidebar lists the page, add an entry under its name with its route to `NAV_DESTINATIONS` (`src/commands/destinations.ts`), and the action of its `go-<name>` command to `src/shell/global-commands.ts`. Both are typed by the destination's name, so a missing one fails `tsc`.
5. If upstream serves the same address, keep upstream's path. Run the link test.
6. Run `bun run test src/navigation src/app tests/map` and `bun run typecheck` in `packages/tl-dispatch`.

## Links and moves

| API | Use |
| --- | --- |
| `<PageLink page={route} params={...} search={...}>` | A link. `params` is required only where the path binds a `:name`. |
| `pageHref(route, params?, search?)` | The address as a string, for an API that takes one. |
| `<Redirect page={route} ...>` | A route element that replaces the address with another page's. |
| `usePageNavigate()` | A move in code: `navigate(route, { params, search, replace })`. |
| `usePageParams(route)` | The params of the page the address is on. It throws on another page. |
| `usePageSearch(route)` | The search keys the route declares, from the address. |
| `useCurrentRoute()`, from `src/shell/page-layout.ts` | The page, the route and the layout the address opens, as the router ranks them. |
| `useAddress()` | The address as text, for upstream helpers that read it. |

A wrong route, a wrong param name or an unknown search key fails the type check. `PageLink`, `Redirect` and `usePageNavigate` also refuse a call with no `params` where the path binds one. `pageHref` takes `params` as optional: `pageHref(route)` on such a path passes the type check and throws when it runs.

## Prefetch on intent

`packages/tl-dispatch/README.md` ("Navigation") says when `PageLink` starts the route's `prefetch` reads; the delay is `PREFETCH_INTENT_MS`. Give each route whose page reads data on open a `prefetch`.

## Checks

- `src/navigation/*.test.ts(x)`: the grammar, typed links, hooks and prefetch.
- `src/app/routes.test.tsx`: the route map, the route tree, and each page's layout against upstream's rules for the frame.
- `tests/layering.test.ts`: the router rule, through every import the build resolves.
- `tests/map/links.test.ts`: every upstream route, reference form and server-written address opens the same page here.
- A reviewer checks that a diff adds no path string literal outside `src/navigation/routes.ts` and no router import outside `src/navigation` and `src/app`.
