# Theme tokens

The theme is a shadcn theme on CSS variables. Change a token only in `packages/ui/src/styles/theme.css`, in the light block and in both dark blocks, and run `packages/ui`'s tests. Never write a raw colour (`#hex`, `rgb()`, a named colour, a Tailwind palette class such as `bg-slate-100`). The design-rule tests refuse each one. Use the Tailwind utility of a token: `bg-card`, `text-muted-foreground`, `border-border`, `outline-focus`.

## The fixed choices

- Monochrome. Colour shows meaning only: a failed state, a state that waits on a person, a passed state, and a destructive action.
- Corners are steps of one `--radius` (8 px): sm 4, md 6, lg 8 and xl 12 px; `--radius-badge` names sm. In tl-dispatch only a dot or an avatar is round (`rounded-full` with a `size-*`); see SU6.
- Every colour, corner, shadow, row height and stroke is a token in `packages/ui/src/styles/theme.css`. A page or a stylesheet names the token and never writes a literal.
- Geist for text (`font-sans`), Geist Mono for code values (`font-mono`).
- Focus is a 2 px outline, offset 2 px, in `--focus` (`outline-focus`). Nothing else draws focus.
- Dark follows the operating system.

## Surfaces, from the back

| Token | Use |
| --- | --- |
| `background` | The frame: the window behind the content panel, the sidebar and its header. Also the panel of a dialog, an alert dialog, a sheet and a drawer. |
| `sidebar` | In light, the same colour as `background`. In dark it is `card`'s colour, so the frame draws the sidebar on `background` (FR2). |
| `card` | The content panel, where lists, boards and record views draw. |
| `secondary` | The highlighted row on the content panel, whether the pointer or the keyboard put it there. Also the hover of an outline or a ghost button. |
| `muted` | A selected row, a group header row, and a quiet fill such as a count chip or a code block. |
| `accent` | Hover inside a menu or a popover. Do not use it on the content panel. |
| `sidebar-accent` | The current row in the sidebar. The hovered row is `sidebar-accent/50`, so hover and current differ. The current row keeps its weight, so its label does not change width. |
| `popover` | A menu, popover, combobox, tooltip, hover card, command menu or toast. |
| `field` | The inside of an input. |
| `scrim` | The backdrop of a modal overlay, at 50 %. |

Measured on the content panel (`card`), light / dark: `secondary` 1.10 / 1.09, `muted` 1.15 / 1.16, `background` 1.21 / 1.11. The steps are small on purpose: a step separates, a border outlines.

## Lines

| Token | Use |
| --- | --- |
| `border` | Dividers, the content panel's edge, an overlay's edge, a table's cells. |
| `input` | The edge of a control: input, select, checkbox, outline button. It reaches 3:1 on the page, a card and `muted`. |
| `sidebar-border` | The sidebar's dividers. |

## Text

| Token | Use |
| --- | --- |
| `foreground` | Titles, body text, values. |
| `muted-foreground` | Metadata: ids, dates, counts, descriptions, placeholder text, a property's label. |
| `primary-foreground`, `destructive-foreground` | Text on a primary or destructive fill. |

Never lower a text token's opacity: the contrast tests read the token, not the mix.

## Meaning

| Tokens | Meaning |
| --- | --- |
| `primary` | The one primary action of a view: near black in light, near white in dark. |
| `destructive`, `destructive-foreground` | The button that does a destructive action: a confirm's Delete or Revoke. The row button that opens the confirm is an outline button. |
| `danger`, `danger-tint`, `danger-border` | A failed state: a failed check, a refused write, an error. |
| `warning`, `warning-tint`, `warning-border` | A state that waits on a person: an open ask, a blocked item. |
| `success`, `success-tint`, `success-border` | A passed state: a passed check, a merged or deployed change. |
| `chart-1` to `chart-5` | Chart series, in this order. |

Use the `*-tint` fill and the `*-border` line together for a whole block of a state, such as an error banner. Use the plain token for an icon or a short label. A state never shows by colour alone: an icon or a word goes with it.

## Size scales

- Control heights: `h-6` (24 px), `h-7` (28 px), `h-8` (32 px, the default), `h-9` (36 px). On a coarse pointer every control reaches 44 px. A test refuses any other control height.
- Icons in a control: `size-3`, `size-3.5` or `size-4`. Status and priority icons: `size-3.5` in rows, `size-4` in the properties panel.
- Spacing is on the 4 px scale. No arbitrary values (`mt-[13px]`).
- Type comes from `SurfaceTitle`, `Heading` and `textVariants`, never from raw `text-*` or `font-*` classes. `SurfaceTitle` is the page's `h1`. `Heading` starts at `h2` and takes its rank from the `HeadingSection` around it. Both take a `size` of `headingVariants`. Running text is `Text`, which takes the same `size`, `tone` and `weight` as `textVariants`; a part that draws its own element passes `textVariants(...)` to `className`.

| Recipe | Classes | Use |
| --- | --- | --- |
| Heading `page` | `text-xl font-semibold tracking-tight` | A record's title on its own page. |
| Heading `section` | `text-base font-semibold tracking-tight` | A section of a record or a settings page. |
| Heading `group` | `text-sm font-semibold tracking-tight` | A list's title in the header, a group header row. |
| Heading `label` | `text-xs font-medium` | A property's label, a menu section label. |
| `textVariants` `body` | `text-sm` | Rows, body text, controls. |
| `textVariants` `caption` | `text-xs` | Metadata in a row, a hint under a field. |
