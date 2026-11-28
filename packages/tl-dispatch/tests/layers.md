# The layers

`tests/layers.table.ts` holds the rules as data, and `tests/layering.test.ts` checks each import of the app and of its tests against them.
This file gives the reason for each rule.
A pull request that changes a rule changes the table and this file together.
The test fails when a rule of the table has no heading here that names it.

The test resolves each import as the build does: the tsconfig paths, the Vite alias, then the packages.
Thus a relative path or an alias cannot avoid a rule.
A type-only import is read too, because a lower layer that names a type of a higher one depends on it.

## Placing a new file

Ask these questions in order, and stop at the first yes.

1. Does it draw from props alone, with no data, no router and no app file? It goes to `packages/ui`.
2. Does it set the unload prompt, or read or write one of upstream's storage keys? It goes to `src/browser`.
   Is it state the fork keeps in the browser? It is a store in `src/stores`.
3. Does it only re-export upstream's code by name? It goes to `src/upstream`.
4. Is it a hook through which a view reads or writes server data? It goes to `src/data`.
5. Is it a command, the router or a chunk loader? It goes to `src/commands`, `src/navigation` or `src/loading`.
6. Is it a connected part that more than one feature uses? It goes to `src/parts/<name>`.
7. Is it a view of one page? It goes to `src/features/<page>`.
8. Is it the frame around each page? It goes to `src/shell`.
9. Is it a page's frame options, prefetch and lazy element? It is the page's `route.tsx`.
10. Is it the route tree, the providers or the start? It goes to `src/app`.

## Every file has a layer (`every-file-has-a-layer`)

Each file under `src/` is in a row of the table, or is one of the root files: `main.tsx`, the entry that only `index.html` loads; `views.ts`, the lists of the view map; and the stylesheets.
A new folder that no row names has no rules, so the test refuses each of its files, its tests included, until a row names it.
A feature and a part are folders: a loose file directly under `src/features` or `src/parts`, an `index.ts` there included, is in no layer.

## A layer imports only the layers above it (`imports-only-above`)

`ROWS` in the table lists the layers from the top.
A file imports its own layer and the layers above it, and the UI package counts as above every layer.
Thus a change to a layer touches only the layers below it, and no lower layer names a type of a higher one.
The shell sits below the features so that it can draw their small parts, and the route files sit below the shell because they import its `PageLayout`.
`src/app`, the composition root, is the last row: no layer imports it, and of the files in no layer only `main.tsx` does (`READERS`); a test may too.
The app's route map reaches the shell the other way: the app gives it to `RouteProvider`, and no lower layer names a type of the app.

A test file under `src/` is in the layer of the file it tests; a test directly under `src/` whose file has no layer is in `tests`.
A file under `tests/` is in the layer `tests`, which may import each layer of the app.
Only a test imports a file of `tests/`, or any other file of the package outside `src/`, such as `vite.config.ts` or a script.

## One row: the layers that do not import each other (`one-row`)

The folders of one row do not import each other.
`src/commands`, `src/navigation` and `src/loading` are one row, with two exceptions for `src/commands`: it imports `src/loading`, and the one file `src/navigation/routes.ts`, which holds the route paths.
A command takes callbacks named for what it does, so it needs no router; `src/navigation` imports neither of the other two.
`src/stores` shares the seam's row: a store imports only `src/browser`, the seam never imports a store, and each layer below them may import both.

## Only the seam imports upstream (`only-the-seam-imports-upstream`)

Only `src/upstream` imports upstream's code: upstream's web app, its contracts and its document editor.
The seam is then the list of what the fork depends on, and an upstream change that breaks the fork breaks it in one folder.
A test imports upstream through the seam, or through `tests/upstream.ts`, the one door for upstream's test helpers and the modules only tests read.
`src/styles.css` imports upstream's stylesheet, because a stylesheet re-exports nothing; the table names it as a door with its reason.

## Each seam file has its readers (`seam-readers`)

`READERS` in the table gives the readers of each seam file, as the spec's seam table does, so a seam file serves one subject to the layers that need it.
A page's view file, `src/upstream/views/<page>.tsx` or the folder of that name, is read only by that page's `route.tsx` and `page.tsx`.
A page with more than one view gets the folder, with one file for each view: an `import()` of a file loads every view it gives, so each lazy chunk has its own file.
`src/app` also reads the data seam files that a provider needs, and `write-kinds.ts`, which registers upstream's kinds of writes.
`mark.tsx` is read by the seam files, and for `ForkView` by the layers that pass fork elements into a marked component.
A seam file may read another, and a test may read each seam file.
The root files have readers too, and a test is held to them: `views.ts` is read only by the tests of the view map (`tests/map`) and of the parity lists (`tests/parity`), a stylesheet only by `main.tsx` and `styles.css`, and `main.tsx` only by `tests/main.test.tsx`, which loads the entry once to see the order of its first two steps.
A seam file or a root file that the table does not list has no reader, so a new one comes with its row.

## A library and its owners (`library-owners`)

Only `src/navigation` and `src/app` import the router (`react-router-dom`, or any `@tanstack/*router*`), so a router move changes two folders: the app's routes and providers sit in `src/app`, and the shell reads the address through `src/navigation`.
Only `src/data` and `src/app` import `@tanstack/react-query`: a view reads and writes through `src/data`.
No file of the app imports `@base-ui/react`: Base UI comes through `packages/ui`.
Only `src/parts/priority` imports the UI package's `BarsGlyph`, so a priority and an urgency take their bars from its one table of levels.
A test may import the router and the query library, which a page test needs to draw the page with its own client.

## No import of the own index (`no-own-index`)

A file of a feature or of a part imports the files of its own folder directly, never its own `index.ts`.
The index is the folder's face to other code, and a file that imports it can make a cycle inside the folder.

## The index only at the root (`index-only-at-the-root`)

Only the root of a feature or of a part has an `index.ts`, so each folder has one face.

## Through the index (`through-the-index`)

A file outside a feature or a part, of any layer, imports it only through its `index.ts`; a test under `tests/` is the one exception.
The page's own `route.tsx` sits in the feature's folder, so it imports the feature's files directly.
Thus the files behind the index can change without a change to the folders that use it.

## No cycles (`no-cycles`)

The imports between features make no chain that returns to its start, and the same holds between parts.
A cycle makes two features one, and the test names the folders of each cycle once.

## Readable imports (`imports-are-readable`)

Each import names one module that the test can resolve.
An `import.meta.glob`, a non-literal `import()` or `require()`, and a path that resolves to no file name no module a rule can read, so the test refuses them; write the path.

## Upstream's app never loads (`upstream-app-never-loads`)

No file of the app or of its tests, and no file of `e2e/` or `scripts/`, reaches upstream's `app.tsx` or `main.tsx`, directly or through upstream's code.
Upstream's app opens a second sign-in channel when it loads, and its entry loads the app.
The test follows each import of the app through upstream's code, and names the chain at the file of the app that starts it.

## A view or a widget draws inside the mark (`views-are-marked`)

Each component that a `views/` or `widgets/` file of the seam gives draws inside the upstream mark: `upstreamView(Component)` of `src/upstream/mark.tsx` wraps it in one `<span data-upstream-view>` that gives no box.
The axe run and the one-primary check skip what is inside the mark, because upstream's own tests read it.
Fork elements that a fork part passes into a marked component go inside `ForkView`, the `data-fork-view` span of the same file, so the checks read them again.
The rule reads the file, not the component: each export is a `const` set to the mark's `upstreamView(...)` of a component imported from upstream, a hook (`use…`), a provider (`…Provider`), a type, or a name that `UNMARKED` in the table lists with its reason.
`UNMARKED` is for a context, a component that renders nothing, and a component that draws a table row, an option, SVG, a list item or a term, which a `<span>` around it would break.
Any other export fails, a class such as `ErrorBoundary` included, and so do `export *` and `export * as`, which name nothing the rule can read.
`shell.tsx` gives providers, contexts and hooks beside its marked components, so the rule does not read it, and its reviewer checks each export.

## Today's breaks

`BREAKS` in the table lists each import that breaks a rule today, by rule, file and specifier, once for each time the file writes it.
The test fails when an import breaks a rule and is not in the list, and when an entry of the list breaks no rule.
A file that moves keeps its entries under its new path.
A new entry shows in the pull request's diff of the table, and the reviewer refuses it.

## Only the app imports a route file (`only-the-app-imports-routes`)

A route file, `src/features/<page>/route.tsx` (or `route.ts`), puts the page's element on its routes, and only `src/app` imports it, to make the route tree; a test may import it too.
The shell and a feature link to a page through `src/navigation/routes.ts`, which holds each route's address, so no file needs another page's route file.
A route file imports no other route file.

## A route file loads its page lazily (`pages-load-lazily`)

A page's `page.tsx` is imported only by its own `route.tsx`, and only with `import()`, so no page goes into the entry chunk except those `EAGER` names; a test may import it directly.
A type-only import loads nothing, so the rule does not count it.
The exceptions are in `EAGER`, each with its reason: the Inbox is the home page, so its route imports its `page.tsx` statically and it draws at first paint with no loading fallback; upstream draws the machine login and not-found pages at first paint, and a lazy page would show the skeleton first.
Each entry names a file that exists, with a reason: a page its own route imports statically, or a feature's other file or an upstream view that an eager page imports statically (the not-found view, which the machine login page draws too, and upstream's Inbox).
`scripts/check-entry-modules.ts` reads `EAGER` from `tests/layers.table.ts`: after a build, `bun run check:entry-modules` fails when a feature's file other than its route file, a seam view or the upstream module a seam view gives is in the entry chunk and `EAGER` does not name it, and when an entry is not in the entry chunk.
A route file loads each upstream view with `import()` for the same reason; the page's `page.tsx` may import its upstream view directly, since the page itself loads lazily.

## A route file draws nothing (`routes-draw-nothing`)

A route file draws no element of its own (a lowercase JSX tag), and it imports a value only from what `ROUTE_IMPORTS` in `tests/layers.table.ts` names, each with its reason, and from the pages `EAGER` names: navigation, `prefetchOf`, `lazyNamed`, upstream's queries and the live views' route.
So it imports no file of the UI package, no icon, no part, no other feature and no file of its own folder but an eager page: the page it loads draws, and the route file holds only the page's frame options, its prefetch and its lazy element.
