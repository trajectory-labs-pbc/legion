# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds | May import |
| --- | --- | --- |
| `src/ui` | Components and tokens: no data, no router | packages and `src/ui` only |
| `src/commands` | The command catalog, compiled to upstream's key engine | no router and no `src/shell` or `src/pages`: commands take callbacks |
| `src/shell` | The frame every page renders in | anything that does not reach upstream's `app.tsx` or `main.tsx` |
| `src/pages` | One file per page: its routes, the app that draws it and the upstream views it maps | the same as `src/shell` |

`tests/layering.test.ts` holds these rules. It resolves every import as the build does (the
tsconfig paths and the `@upstream-dispatch` alias), follows them through upstream's code, and
refuses an import it cannot resolve or a non-literal `import()`.

## Theme

`src/ui/theme.css` is a shadcn registry theme item, written by `shadcn add` into the file
`components.json` names. Never edit it by hand. To take a new version of the item, from this
directory:

```sh
bunx --bun shadcn@4.23.0 add <path to the item>/theme-system.json
```

The first line of `theme.css`, `@custom-variant dark (@media (prefers-color-scheme: dark));`, makes
the dark scheme follow the operating system; keep it when the file is written again.

`src/ui/tokens.css` holds this app's own tokens beside the theme:

- `--focus` (`outline-focus`), the focus indicator: `--chart-5` in light, where `--ring` is below
  3:1 on the light surfaces, and `--ring` in dark.
- `--input` in light, the control border: the ink mixed into the page until it reaches 3:1 on the
  page, a card and a muted surface. Dark and `--border` keep the theme's values.

## Commands

`src/commands/app-catalog.ts` declares every command once. Its global context holds the keys the
shell binds today, with the same behaviour, and adds `G M` and the pages with no letter. The
catalog refuses, when it loads, two keys live together that one press sequence matches or where
one starts the other, as upstream's key engine compares them.

## Checks

- `bun run test`: the layers, the design rules, the contrast of every text pair, of focus and of
  light control borders, the catalog, and the key engine's behaviour the catalog relies on.
  The design rules compile the app's own classes with Tailwind and check the CSS they emit.
  `tests/design-config.ts` lists the only files they leave out.
- `bun run build && bun run check:entry-budget`: the entry chunk stays within its budget.
- `bun run typecheck`, `bun run lint`.

`.github/workflows/tl-dispatch.yaml` runs all of them.
