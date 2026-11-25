---
name: ui-design-system
description: "Use when you build or review a page, a layout, a list, a menu, an overlay or any visual change in packages/tl-dispatch or packages/ui: the layout and interaction rules taken from Linear, the theme tokens, and when to use or add a packages/ui component."
---

# The design system

tl-dispatch follows Linear's layout and interaction as closely as the theme allows. The theme wins where the two differ: monochrome, square corners, Geist, colour for meaning only, no shadows, and a 2 px focus outline. Each rule has an ID. A reviewer cites the ID of each rule a change breaks. Where another rule you find disagrees with these, these hold. A check marked (new) in a reference is a test to write with the first page that needs it.

## Read first

- `references/tokens.md` before you choose a colour, a surface, a size or a type style.
- `references/frame-and-lists.md` when you build the frame, a list, a board or a group header (FR, LR).
- `references/surfaces-and-type.md` when you choose a surface, a border, a height, a spacing or a type style (SU, TY).
- `references/records-and-status.md` when you build a record's page, a peek, a property, a status or a priority (IV, SP, IE).
- `references/keyboard-and-feedback.md` when you add a key, a menu, a cursor, an empty state, a toast, motion or focus (KB, CX, PT, ES, TO, MO, FO).
- `.agents/skills/commands/SKILL.md` for how keys, buttons and menu rows read the command catalog.

## The rules that matter most

1. **FR2** The frame is an inverted L: the sidebar and the window behind the content share `bg-background`; the content panel is `bg-card` with a 1 px `border-border` edge. No shadow.
2. **LR1** A list row is one line, 36 px high, with no border between rows. The title truncates; nothing wraps.
3. **LR3** The pointer and the keyboard share one highlight per list. `j`/`k` and the arrows move it; the pointer moves it on hover.
4. **LR5** `x` selects the highlighted row; Shift+click and Shift+arrow extend; `$mod+a` selects all. A selected row shows a checked box. A bar at the bottom names the count and the actions; Escape clears.
5. **IV3** Space opens the highlighted record in a peek at the right. The list stays usable; `j`/`k` move the peek; Enter opens the page; Escape or Space closes it.
6. **SU1, SU2** Surfaces separate by a background step or a 1 px border, never by a shadow. No coloured stripe on the left of a card or a row.
7. **SP1** A status shows as a 14 px icon whose shape follows the lifecycle; a priority as bars. Neither uses colour; colour marks only a failed, a waiting or a passed state.
8. **KB2, KB3** Every action has one command, and every surface shows its key: tooltip, menu row, palette row. `s`, `p` and `l` open the status, priority and label pickers for the selection, else the highlighted row, else the record in view.
9. **IE1** A property changes where it is shown: a click on it opens its picker in place. The write shows at once and rolls back with a toast if the server refuses it.
10. **CX1** Right-click on a row opens the same menu as its `⋯` button, with the same sections and key hints. On a selected row it acts on the selection.
11. **ES1** An empty view shows an icon, one line of title, one sentence, and at most one action with its key. A view filtered to nothing says so and offers Clear filters.
12. **TO1** A toast is one line at the bottom right, with an Undo for a reversible write.

## Components: use, change or add

The components live in `packages/ui` (`@legion/ui`): shadcn components on Base UI, on this theme.

1. Search `packages/ui/src/components` before you write markup for a control, an overlay, a list part or a value. Use the component as it is.
2. Choose a look with the component's `variant` and `size`. Use `className` only for layout: margin, width, flex, grid. Never override a colour, a height, a radius, a border or a shadow.
3. Never write a styled `<button>`, a native `<select>` or a hand-built dialog, menu or tooltip in tl-dispatch.
4. Add a component to `packages/ui` when it renders from props alone (no query, no router, no command store, no app state) and it is a control, an overlay, a layout part or a value display. Add it with `shadcn add` or write it in the same style, give it a test file beside it, and run the package's `registry` script, which writes the root `registry.json`.
5. Keep a component that reads data, the router or the command store in tl-dispatch, beside the page or the shell that uses it.
6. Fix a `packages/ui` component in `packages/ui`. Never copy it into tl-dispatch to change it.
7. The components follow these rules too: no shadow (SU1) and fades only (MO2). Remove a shadow or a scale animation you find there.

## Checks

- `bun run test` in `packages/tl-dispatch`: the design-rule tests refuse a raw colour, a colour outside the tokens, focus drawn in another colour, text at lower opacity, a radius outside the theme, a round element that is not a dot or an avatar, motion outside `motion-safe:`, and a control height outside the scale. The contrast tests check every text pair, the focus colour and the control borders in both schemes.
- A reviewer checks each rule in the references that no test holds. Each rule there says how it is checked.
- A change to a visible surface comes with a light and a dark screenshot of each page it changes.
