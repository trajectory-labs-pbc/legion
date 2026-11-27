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

`globals.css` is the whole entry: Tailwind, the theme, the dark variant and the base rules. An
app that already has a Tailwind entry and base rules of its own imports `theme.css` alone: the
fonts, the tokens and the components' sources. Dark then follows the OS setting, and the app
gives the components their edge and focus colours, which the base rules set on every element.

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
- `bun run registry:validate` runs `shadcn registry validate` on it. A test runs the same check.
- Every style is a token of `src/styles/theme.css`, and the components name the token, so one
  edit there restyles every part that draws it: the colours (light in `:root`, dark in `.dark` and
  in the `prefers-color-scheme: dark` block, which must match; a `.light` class on the root keeps
  light when the OS is dark), the corners (steps of the one `--radius`, and `--radius-badge` for a
  badge), the two shadows (`shadow-popover`, `shadow-dialog`, in the scheme's `--shadow-tint`),
  the edge width (`--border-width`, which every `border` class draws), the table row (`h-row`),
  a small control (`h-control-sm`), a list row of one line (`h-list-row-1`, 36 px, which a group
  header also takes) and of two lines (`h-list-row-2`, 56 px), and the icon stroke
  (`--icon-stroke`). The style test holds these four heights and no other.
- `src/styles/styles.test.ts` compiles the stylesheet with Tailwind over the package's sources and
  checks the CSS it generates: no shadow but the theme's two and the 1px inset edge, opacity fades
  of 150 to 200 ms only, no pointer cursor, no arbitrary properties, one set of dark values, and
  corners from the theme. `--radius` is one length, each step is `--radius` times 0.5 to 1.5, and
  the only other radius is `rounded-full`, which a source check allows on eight parts only: the
  radio item and its dot, the switch and its thumb, the slider thumb, the avatar, the avatar
  group's count and a list row's dot. A list row, like a scroll container, draws its focus outline
  inside itself, so its list does not clip it; every other part draws it 2 px outside. It also checks the contrast of each text colour on each
  surface the components draw it on, of the focus outline and the field and state edges, and of a
  priority's track against its filled bars and each row fill.
