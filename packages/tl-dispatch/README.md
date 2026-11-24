# tl-dispatch

A Dispatch web app that shows upstream's pages (`packages/dispatch/web`) inside its own shell and
replaces them one page at a time.

## Folders

| Folder | Holds | May import |
| --- | --- | --- |
| `src/ui` | Components and tokens: no data, no router | packages and `src/ui` only |
| `src/commands` | The command catalog, compiled to upstream's key engine | no router: commands take callbacks |
| `src/shell` | The frame every page renders in | anything but upstream's `app.tsx` |
| `src/pages` | One file per page: its routes, the app that draws it and the upstream views it maps | anything but upstream's `app.tsx` |

`tests/layering.test.ts` holds these rules.

## Theme

`src/ui/theme.css` is a shadcn registry theme item, written by `shadcn add` into the file
`components.json` names. Never edit it by hand. To take a new version of the item, from this
directory:

```sh
bunx --bun shadcn@4.23.0 add <path to the item>/theme-system.json
```

The first line of `theme.css`, `@custom-variant dark (@media (prefers-color-scheme: dark));`, makes
the dark scheme follow the operating system; keep it when the file is written again.

`src/ui/tokens.css` holds this app's own tokens beside the theme: `--focus` (`outline-focus`), the
focus indicator, which is `--chart-5` in light, where `--ring` is below 3:1 on the light surfaces,
and `--ring` in dark.

## Checks

- `bun run test`: the catalog, the layers, the design rules and the contrast of every text pair
  and of focus, in light and dark.
- `bun run build && bun run check:entry-budget`: the entry chunk stays within its budget.
- `bun run typecheck`, `bun run lint`.
