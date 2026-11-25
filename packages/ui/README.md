# @legion/ui

React components on [Base UI](https://base-ui.com), styled with Tailwind CSS 4, in
[shadcn's monorepo layout](https://ui.shadcn.com/docs/monorepo): `src/components`, `src/lib`,
`src/hooks` and `src/styles`, with a `components.json`.

## Use it from a package in this repository

The package installs on its own, outside the root workspaces, and links React and the test tools
from the root install (`scripts/link-root-packages.ts`). React, React DOM, `@base-ui/react`,
`class-variance-authority`, `cn` and `lucide-react` are peer dependencies, so an app that imports
the package bundles one copy of each.

```css
@import "@legion/ui/globals.css";
```

```tsx
import { Button } from "@legion/ui/components/button";
```

## Add the components to another project

The root `registry.json` is a shadcn GitHub registry. Its items point at this package's sources,
so `shadcn add` copies them as they are here:

```sh
bunx --bun shadcn@4.23.0 add --yes trajectory-labs-pbc/legion/theme#<ref>
bunx --bun shadcn@4.23.0 add trajectory-labs-pbc/legion/font-geist#<ref> trajectory-labs-pbc/legion/font-geist-mono#<ref>
bunx --bun shadcn@4.23.0 add trajectory-labs-pbc/legion/button#<ref> trajectory-labs-pbc/legion/dialog#<ref>
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
- The colours are in `src/styles/globals.css`, light in `:root` and dark in `.dark` and in the
  `prefers-color-scheme: dark` block, which must match. `src/styles/styles.test.ts` holds the
  focus, motion, corner and contrast rules.
