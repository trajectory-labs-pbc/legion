# Surfaces, density and type

Each rule names the Linear surface it comes from, the pages it applies to, and its check. A check marked (new) is a test to write with the first page that needs it; until then a reviewer holds the rule. The tokens are in `tokens.md`.

## Surfaces (SU)

**SU1** No shadow on any surface: a control, a row, a card, a panel, a menu, a dialog, a toast. Surfaces separate by a background step or a 1 px border. A modal overlay adds the scrim. Linear: surfaces that step in lightness for elevation; Linear still draws a soft shadow under floating layers, which this theme leaves out. Pages: all. Check: the design-rule tests refuse a Tailwind shadow class (`shadow-sm`) as a raw colour; `packages/ui`'s style test refuses any shadow but the 1 px inset edge in the components; reviewer for a shadow drawn from a token.

**SU2** No coloured stripe on the left of a card, a row or a block (`border-l-2`, `border-l-4` with a colour). A state shows by its glyph and its word. Upstream draws 21 such stripes in 18 files, for example `features/inbox/AskCard.tsx`; a rebuilt page draws none. Pages: all. Check: (new) a design-rule test fails on a `border-l-*` width.

**SU3** A list item is a row, never a card. A card (a `border-border` box on `bg-card`) holds only a group of settings, a summary block or a board card. Never a card in a card. Linear: lists, settings. Pages: agents, priorities, settings. Check: reviewer.

**SU4** No divider between rows of a list. A 1 px `border-border` line separates the header from the content, the properties panel from the main column, and one section from the next. Linear: the 2026 refresh's fewer separators. Check: reviewer.

**SU5** A floating surface (menu, popover, combobox, tooltip, hover card, command menu, toast) is `bg-popover` with a 1 px `border-border` edge. A modal (dialog, sheet, drawer) is `bg-background` with `bg-scrim/50` behind it. Check: the components' tests in `packages/ui`; reviewer.

**SU6** Square corners everywhere. In tl-dispatch only a dot or an avatar is round. `packages/ui/README.md` lists the parts that are round in the components. Linear's corners are round; this theme's are not. Check: the design-rule radius tests.

## Density (TY1 to TY3)

**TY1** Heights: a list row 36 px, a sidebar row 28 px, a property row 32 px, the view header 44 px, a header control 28 px (`size="sm"`), a form control 32 px (the default). On a coarse pointer every control reaches 44 px. Linear: list and sidebar density. Check: the control-height test; reviewer for rows.

**TY2** Spacing inside a row is 8 px between parts and 12 px at each end. A page's padding is 0 for a list (rows reach the panel's edges) and 24 px for a record's main column. Linear: the issue list. Check: reviewer.

**TY3** Show the most work per screen: a list shows its rows from the top of the panel, with no hero block, summary cards or tall empty bodies above them. Linear: the issue list. Pages: agents, priorities, delivery. Check: reviewer.

## Type (TY4 to TY8)

**TY4** Type comes only from `SurfaceTitle`, `Heading` and `textVariants`; `tokens.md` lists the recipes. No raw `text-*`, `font-*`, `leading-*` or `tracking-*` class in a page. Body and rows are 14 px; metadata is 12 px; a record's title is 20 px. Linear publishes no app text size (its site uses 13 and 15 px); this app keeps the 14/12 scale. Check: (new) a design-rule test fails on a raw size class outside `packages/ui`.

**TY5** Weights: 400 for body text, 500 for a row's title and a label, 600 for a heading. No 700. Linear: Inter, with Inter Display for headings. Check: reviewer.

**TY6** No uppercase labels and no wide tracking. A section label is sentence case at `Heading size="label"`. Linear: the sidebar's small, muted, sentence-case section titles. Check: (new) a design-rule test fails on `uppercase` and `tracking-wide`.

**TY7** Ids, counts, times and numbers in columns use tabular figures (`tabular-nums`). An issue key is in the text face, `muted-foreground`. Geist Mono is for code values only: a commit hash, a branch, a path, a command. Linear: issue ids in the row. Check: reviewer.

**TY8** A label is a noun or a verb with its object, in sentence case: "Create issue", "Status", "Copy link". No full sentence in a sidebar row, a menu row, a button or a palette row. Check: reviewer.
