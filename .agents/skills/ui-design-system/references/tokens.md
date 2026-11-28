# Theme tokens

The theme is a shadcn theme on CSS variables. Change a token only in `packages/ui/src/styles/theme.css`, in the light block and in both dark blocks, and run `packages/ui`'s tests. Never write a raw colour (`#hex`, `rgb()`, a named colour, a Tailwind palette class such as `bg-slate-100`). The design-rule tests refuse each one. Use the Tailwind utility of a token: `bg-card`, `text-muted-foreground`, `border-border`, `outline-focus`.

## The fixed choices

- Monochrome. Colour shows meaning only: a failed state, a state that waits on a person, a passed state, and a destructive action.
- Corners are steps of one `--radius` (8 px): sm 4, md 6, lg 8 and xl 12 px; `--radius-badge` names sm. In tl-dispatch only a dot or an avatar is round (`rounded-full` with a `size-*`); see SU6.
- Every colour, corner, shadow, row height, stroke, layer, fade length and the disabled look is a token in `packages/ui/src/styles/theme.css`. A page or a stylesheet names the token and never writes a literal.
- Geist for text (`font-sans`), Geist Mono for code values (`font-mono`).
- Focus is a 2 px outline, offset 2 px, in `--focus` (`outline-focus`). Nothing else draws focus.
- Dark follows the operating system.

## Surfaces, from the back

| Token | Use |
| --- | --- |
| `background` | The frame: the window behind the content panel, the sidebar and its header. Also the panel of a sheet. |
| `sidebar` | The same colour as `background`, in light and in dark: the sidebar is part of the frame (FR2). |
| `card` | The content panel, where lists, boards and record views draw. |
| `secondary` | The highlighted row on the content panel, whether the pointer or the keyboard put it there. Also the hover of an outline or a ghost button. |
| `muted` | A selected row, a group header row, and a quiet fill such as a count chip or a code block. |
| `accent` | Hover inside a menu or a popover. Do not use it on the content panel. |
| `sidebar-accent` | The current row in the sidebar. The hovered row is `sidebar-accent/50`, so hover and current differ. The current row keeps its weight, so its label does not change width. |
| `popover` | A menu, popover, combobox, tooltip, hover card, command menu or toast, and the panel of a dialog, an alert dialog or a drawer (SU5). |
| `field` | The inside of an input. |
| `scrim` | The backdrop of a modal overlay (`scrimClass`), and the cover over a modal while a nested modal is open (`coveredClass`); both in `packages/ui/src/lib/overlay-styles.ts`. |

The steps from `card` to `secondary`, `muted` and `background` are small on purpose: a step separates, a border outlines.

## Lines

| Token | Use |
| --- | --- |
| `border` | Dividers, the content panel's edge, an overlay's edge, the line under a table's header. |
| `input` | The edge of a control: input, select, checkbox, outline button. It reaches 3:1 on the page, a card and `muted`. |
| `sidebar-border` | The sidebar's dividers. |

## Layers, fades and the disabled look

Each value is a variable on `:root`; the class names it.

| Token | Class | Use |
| --- | --- | --- |
| `--layer-raised` (10) | `z-raised` | Over the content beside it: a sticky header, a focused segment, a list's scroll arrow, a list's selection bar. |
| `--layer-overlay` (50) | `z-overlay` | Over the page: a popover, a menu, a tooltip, a dialog, a sheet, a toast, the skip link. |
| `--duration-popup` (150 ms) | `duration-popup` | The fade of a popover, a menu or a tooltip (`popupMotion`). |
| `--duration-modal` (200 ms) | `duration-modal` | The fade of a dialog, a sheet, a drawer or a scrim (`modalPopupMotion`). |
| `--disabled-opacity` (50%) | `opacity-disabled` | A disabled control, under its disabled variant (`disabled:`, `data-disabled:`, ...). |

- A layer or a fade's length is never a number (`z-50`, `duration-150`) and never the `transition` shorthand. A stylesheet names the variable: `z-index: var(--layer-overlay)`. Only `packages/ui/src/styles/theme.css` declares these variables, and only these names exist. Nothing else sets `--default-transition-duration` either, so a `transition-*` class with no `duration-*` keeps Tailwind's 150 ms. `packages/ui`'s style test and tl-dispatch's design-rule test both refuse a number, the shorthand, a name the theme does not declare, and a declaration of one of these variables outside the theme. tl-dispatch's test also refuses, outside the theme, any key in the namespaces these classes resolve through (`--z-index-*`, `--transition-duration-*`, `--opacity-disabled`), new or not, and a declaration of any of these names in any block, `@theme`, `@property`, `@keyframes` and `@layer properties` included. It refuses a reset that clears one of them too (`--opacity-*`, `--z-*`, `--*`, or `--z-index-overlay-*` inside a namespace), since Tailwind clears every key that starts with the reset's stem, and it reads an `@property` rule whatever the case of its at-rule name (`@PROPERTY`), with the variable's name unescaped and lower-cased as a declaration's name is. A stylesheet's `@layer properties` block is checked like any other, and so is a class under `[@layer_properties]:`; only Tailwind's own block in the compiled CSS, the `--tw-*` initial values on `*, ::before, ::after, ::backdrop`, is skipped.
- The one exception is the drawer: while a finger drags it, `data-swiping:duration-0` stops its fade.
- The fade's curve is Tailwind's default.
- A disabled control dims to `opacity-disabled`. Its variant may also set `pointer-events-none` or `cursor-not-allowed`, and nothing else. The primary button also takes `bg-muted` and `text-muted-foreground` when disabled: at half opacity alone its fill reads brighter than the button beside it in dark. Only `packages/ui`'s style test checks the disabled look. tl-dispatch's `repaint.css` gives upstream's disabled primary button the same muted pair, and keeps upstream's disabled pager button at full opacity with the faint text, so that its edge stays.
- `cn` does not know these classes, so it does not merge them: a `className` of `z-*`, `duration-*` or `opacity-*` on a part that sets one of them adds a second class and does not replace it.

## Text

| Token | Use |
| --- | --- |
| `foreground` | Titles, body text, values. |
| `muted-foreground` | Metadata: ids, dates, counts, descriptions, placeholder text, a property's label. |
| `track` | Never text: a glyph's unfilled part, a priority's unfilled bars, a neutral bar's faint second value. It stays 4.5:1 or more from `foreground` and 1.8:1 or more on the page, a card, a popover and each row fill (`secondary`, `muted`, `accent`). |
| `primary-foreground`, `destructive-foreground` | Text on a primary or destructive fill. |

Never lower a text token's opacity: the contrast tests read the token, not the mix.

## Meaning

| Tokens | Meaning |
| --- | --- |
| `primary` | The one primary action of a view: near black in light, near white in dark. |
| `destructive`, `destructive-foreground` | The button that does a destructive action: a confirm's Delete or Revoke. The row button that opens the confirm is an outline button. |
| `danger`, `danger-tint`, `danger-border`, `danger-faint` | A failed state: a failed check, a refused write, an error. |
| `warning`, `warning-tint`, `warning-border` | A state that waits on a person: an open ask, a blocked item. |
| `success`, `success-tint`, `success-border`, `success-faint` | A passed state: a passed check, a merged or deployed change. |
| `chart-1` to `chart-5` | Chart series, in this order. A chart of one series with no verdict draws its bars in `faint-foreground` instead: `chart-1` is the foreground, louder than the status colours in both themes, and `chart-2` is louder than them in light. |

Use the `*-tint` fill and the `*-border` line together for a whole block of a state, such as an error banner. Use the plain token for an icon or a short label. A state never shows by colour alone: an icon or a word goes with it. A chart's second value behind its bar takes `*-faint`, which reaches 1.8:1 on each row fill and from the plain token; a neutral second value takes `track`.

## Size scales

- Control heights: the steps of `CONTROL_HEIGHTS` in `packages/tl-dispatch/tests/control-scale.ts`, with `h-8` (32 px) the default; on a coarse pointer every control reaches `TOUCH_MIN_HEIGHT`. The design-rule tests read that file and refuse any other control height.
- List rows: `h-list-row-1` (36 px, one line, and a group header) and `h-list-row-2` (56 px, two lines). There is no third row height.
- Icons in a control: `size-3`, `size-3.5` or `size-4`. Status and priority icons: `size-3.5` in rows, `size-4` in the properties panel.
- Spacing is on the 4 px scale. No arbitrary values (`mt-[13px]`).
- Type comes from `SurfaceTitle`, `Heading` and `textVariants`, never from raw `text-*` or `font-*` classes. On a page, `SurfaceTitle` is the `h1` and `Heading` starts at `h2`; inside an overlay, `OverlayOutline` makes the title an `h2` and the first `Heading` an `h3`. `Heading` takes its rank from the `HeadingSection` around it. Both take a `size` of `headingVariants`. Running text is `Text`, which takes the same `size`, `tone` and `weight` as `textVariants`; a part that draws its own element passes `textVariants(...)` to `className`. Each recipe's classes are in `packages/ui/src/lib/typography.ts`.

| Recipe | Use |
| --- | --- |
| Heading `page` | A record's title on its own page. |
| Heading `section` | A section of a record or a settings page. |
| Heading `group` | A list's title in the header, a group header row. |
| Heading `label` | A property's label, a menu section label. |
| `textVariants` `body` | Rows, body text, controls. |
| `textVariants` `caption` | Metadata in a row, a hint under a field. |
| `textVariants` `figure` | A metric's large number: 16 px, weight 600, tabular figures. |
