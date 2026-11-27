---
name: navigation
description: "Use when you add a page or a route to packages/tl-dispatch, write a link or a page move, read a URL param or search key, or are about to import react-router-dom: page files, PageLink, the navigation hooks and the router rule."
---

# Navigation in tl-dispatch

Every address of the app is declared in a page file. Links and moves are typed from those declarations. The code is in `packages/tl-dispatch/src/navigation`.

## The rules

1. Only `src/navigation` imports the router (`react-router-dom`, or any `@tanstack/*router*`). `tests/layering.test.ts` refuses the import anywhere else under `src/`. Upstream's own files keep their router imports.
2. Never write a path as a string. Link with `PageLink`, move with `usePageNavigate`, and build a string address with `pageHref` only where an API needs a string.
3. A command never navigates by itself. It takes a callback (`goTo`), and the shell wires the callback to `usePageNavigate`. See `.agents/skills/commands/SKILL.md`.
4. The URL is the state a reader reloads into or shares: the page, its tab, its filters, its selection, its peek and an open create form. Keep that state in the path or the search keys, not in component state.
5. A filter or a view change replaces the history entry. A new destination pushes one.
6. Every URL form upstream's app accepts still opens the same page. The link test in `tests/map/links.test.ts` checks it.

## Why only one folder imports the router

The app keeps React Router while it still draws upstream's pages, because each of them reads React Router's hooks. A later move to another router must change one folder, not every page. `packages/tl-dispatch/README.md` ("Changing the router") lists every file a move changes and the files that stay. Tests wrap a page in `MemoryNavigationProvider` from `tests/navigation.tsx`.

## Page files

Each page has one file in `src/pages/`. It exports a `Page`:

| Field | Meaning |
| --- | --- |
| `id` | The page's name. |
| `server` | `"upstream"` while the app draws upstream's page; `"fork"` once this app draws its own. |
| `routes` | Named routes, each written with `pageRoute`. A link names the route it opens. |
| `views` | The upstream view files the page replaces, as paths under `packages/dispatch/web/src`. See `.agents/skills/porting-upstream/SKILL.md`. |

A route is `pageRoute({ path, element, search?, prefetch?, layout? })`:

- `path` uses navigation's grammar, which only `path.ts` reads: `/`-separated text, a `:name` segment for a param, and a last `*` for the rest of the address. `"/issues/:key/*"` binds `key`.
- `search` lists the search keys the page reads, as literals.
- `prefetch(params)` returns the page's first reads, each `prefetchOf(queryOptions)`.
- `layout` says how the shell frames the page: a `PageLayout` (`src/pages/page.ts`), or a function of the address.

`pageRoute` keeps the path and search keys as literal types, so every link to the route is typed.

## Add a page or a route

1. Write or extend the page file in `src/pages/`, with a `pageRoute` for each address.
2. Add the page to `pages` in `src/pages/index.ts`, the route map. `src/navigation` imports no page: `tests/layering.test.ts` refuses it.
3. If the sidebar lists the page, add a row to `NAV_DESTINATIONS` (`src/commands/nav.ts`), its route to `NAV_PAGES` (`src/shell/nav-pages.ts`), and the action of its `go-<name>` command to `src/shell/global-commands.ts`. All three are typed by the destination's name, so a missing one fails `tsc`.
4. If upstream serves the same address, keep upstream's path. Run the link test.
5. Run `bun run test src/navigation tests/map` and `bun run typecheck` in `packages/tl-dispatch`.

## Links and moves

| API | Use |
| --- | --- |
| `<PageLink page={route} params={...} search={...}>` | A link. `params` is required only where the path binds a `:name`. |
| `pageHref(route, params?, search?)` | The address as a string, for an API that takes one. |
| `<Redirect page={route} ...>` | A route element that replaces the address with another page's. |
| `usePageNavigate()` | A move in code: `navigate(route, { params, search, replace })`. |
| `usePageParams(route)` | The params of the page the address is on. It throws on another page. |
| `usePageSearch(route)` | The search keys the route declares, from the address. |
| `useCurrentPage()`, from `src/pages/index.ts` | The page, the route and the layout the address opens, as the router ranks them. |
| `useAddress()` | The address as text, for upstream helpers that read it. |

A wrong route, a wrong param name or an unknown search key fails the type check. `PageLink`, `Redirect` and `usePageNavigate` also refuse a call with no `params` where the path binds one. `pageHref` takes `params` as optional: `pageHref(route)` on such a path passes the type check and throws when it runs.

## Prefetch on intent

`packages/tl-dispatch/README.md` ("Navigation") says when `PageLink` starts the route's `prefetch` reads; the delay is `PREFETCH_INTENT_MS`. Give each route whose page reads data on open a `prefetch`.

## Checks

- `src/navigation/*.test.ts(x)`: the grammar, typed links, hooks and prefetch.
- `src/pages/index.test.ts`: the route tree, and each page's layout against upstream's rules for the frame.
- `tests/layering.test.ts`: the router rule, through every import the build resolves.
- `tests/map/links.test.ts`: every upstream route, reference form and server-written address opens the same page here.
- A reviewer checks that a diff adds no path string literal outside `src/pages` and no router import outside `src/navigation`.
