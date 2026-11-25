# @legion/ui

React components on [Base UI](https://base-ui.com), styled with Tailwind CSS 4, in
[shadcn's monorepo layout](https://ui.shadcn.com/docs/monorepo): `src/components`, `src/lib`
and `src/styles`, with a `components.json`. `src/blocks` holds the parts with words of their
own, such as the shortcuts sheet: each is a `registry:block`, which a project installs among its
components and edits.

## Use it from a package in this repository

The package installs on its own, outside the root workspaces, and links React and the test tools
from the root install (`bun scripts/link-root-packages.ts <package directory>`, which another
package can run on its own directory). `@base-ui/react`, `class-variance-authority`, `cn` and
`lucide-react` are peer dependencies and also dev dependencies, so `packages/ui/node_modules` has
its own copy of each. An app that imports the package from source must dedupe these packages
(Vite `resolve.dedupe`) and check that its build has one copy of each.

```css
@import "@legion/ui/globals.css";
```

```tsx
import { Button } from "@legion/ui/components/button";
import { ShortcutsSheet } from "@legion/ui/blocks/shortcuts-sheet";
```

## Add the components to another project

The root `registry.json` is a shadcn GitHub registry. Its items point at this package's sources,
so `shadcn add` copies them as they are here:

```sh
bunx --bun shadcn@4.23.0 add --yes <owner>/<repo>/theme#<ref>
bunx --bun shadcn@4.23.0 add <owner>/<repo>/font-geist#<ref> <owner>/<repo>/font-geist-mono#<ref>
bunx --bun shadcn@4.23.0 add <owner>/<repo>/button#<ref> <owner>/<repo>/dialog#<ref>
```

shadcn asks before a theme item replaces CSS variables; `--yes` answers it.

Each component item lists every file it imports and has no `registryDependencies`. shadcn does
not pass an item's `#<ref>` on to its dependencies: a dependency with no tag or commit of its own
installs from the default branch, not from the ref you asked for.

## Change it

- `bun run test`, `bun run typecheck` and `bun run lint` check the package.
- After you change a component's imports or the stylesheet, run `bun run registry` to rewrite
  `registry.json`. A test fails while the file differs from what the script writes.
- `bun run registry:validate` runs `shadcn registry validate` on it.
- The colours are in `src/styles/globals.css`: light in `:root`, dark in `.dark` and in the
  `prefers-color-scheme: dark` block, which must match. A `.light` class on the root keeps light
  when the OS is dark.
- `src/styles/styles.test.ts` compiles the stylesheet with Tailwind over the package's sources and
  checks the CSS it generates: no shadow but the 1px inset edge, opacity fades of 150 to 200 ms
  only, no pointer cursor, no arbitrary properties, one set of dark values, and square corners.
  `--radius` is 0, and the only other radius is `rounded-full`, which a source check allows on
  seven parts only: the radio item and its dot, the switch and its thumb, the slider thumb, the
  avatar and the avatar group's count. It also checks the contrast of each text colour on each
  surface the components draw it on, and of the focus outline and the field and state edges.
