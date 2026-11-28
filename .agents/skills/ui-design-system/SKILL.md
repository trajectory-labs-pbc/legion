---
name: ui-design-system
description: "Use when you build or review a page, a layout, a list, a menu, an overlay or any visual change in packages/tl-dispatch or packages/ui: the layout and interaction rules taken from Linear, the theme tokens, and when to use or add a packages/ui component."
---

# The design system

tl-dispatch follows Linear's layout and interaction as closely as the theme allows. The theme wins where the two differ; its fixed choices are in `references/tokens.md`. Where another written rule disagrees with these, these hold. Where a test disagrees with a rule here, never weaken the test: say so in the pull request.

Each rule in the references has an ID, and a reviewer cites the ID of each rule a change breaks. A rule names the Linear surface it comes from, the pages it applies to, and its check. A check marked (new) is a test that does not exist yet: write it with the first change that needs it, and until then a reviewer holds the rule.

## Read first

- `references/tokens.md` before you choose a colour, a surface, a size or a type style.
- `references/frame-and-lists.md` when you build the frame, a list, a board or a group header (FR, LR).
- `references/surfaces-and-type.md` when you choose a surface, a border, a height, a spacing or a type style (SU, TY).
- `references/records-and-status.md` when you build a record's page, a peek, a property, a status or a priority (IV, SP, IE).
- `references/keyboard-and-feedback.md` when you add a key, a menu, a cursor, a pointer target, an empty state, a toast, motion or focus (KB, CX, PT, ES, TO, MO, FO).
- `.agents/skills/commands/SKILL.md` for how keys, buttons and menu rows read the command catalog.

## The rules a change breaks most often

Read each in its reference before you build what it names.

- **FR2** the inverted-L frame (`references/frame-and-lists.md`).
- **LR1** list rows of one line or two; **LR3** one highlight for pointer and keys; **LR5** selection and its bar (`references/frame-and-lists.md`).
- **IV3** the peek; **SP1** status and priority glyphs; **IE1** editing a property in place (`references/records-and-status.md`).
- **SU1, SU2** no shadow at rest and no coloured stripe (`references/surfaces-and-type.md`).
- **KB2, KB3** one command per action, and one-key commands on the subject; **CX1** the context menu; **ES1** empty views; **TO1** toasts (`references/keyboard-and-feedback.md`).

## Components: use, change or add

The components live in `packages/ui` (`@legion/ui`): shadcn components on Base UI, on this theme.

1. Search `packages/ui/src/components` before you write markup for a control, an overlay, a list part or a value. Use the component as it is.
2. Choose a look with the component's `variant` and `size`. Use `className` only for layout: margin, width, flex, grid. Never override a colour, a height, a radius, a border or a shadow.
3. Never write a styled `<button>`, a native `<select>` or a hand-built dialog, menu or tooltip in tl-dispatch.
4. Add a component to `packages/ui` when it renders from props alone (no query, no router, no command store, no app state) and it is a control, an overlay, a layout part or a value display. Add it with `shadcn add` or write it in the same style, give it a test file beside it, and run the package's `registry` script, which writes the root `registry.json`.
5. Keep a component that reads data, the router or the command store in tl-dispatch, beside the page or the shell that uses it.
6. Fix a `packages/ui` component in `packages/ui`. Never copy it into tl-dispatch to change it.
7. The components follow these rules too: a shadow only from the theme's two shadow tokens (SU1) and fades only (MO2). Remove any other shadow or a scale animation you find there.

## Checks

- `bun run test` in `packages/tl-dispatch`: the design-rule tests refuse a raw colour, a colour outside the tokens, focus drawn in another colour, text at lower opacity, a radius outside the theme, a round element that is not a dot or an avatar, motion outside `motion-safe:`, a scale, a pointer cursor, and a control height outside the scale.
- `bun run test` in `packages/ui`: `packages/ui/src/styles/styles.test.ts`, whose checks `packages/ui/README.md` lists. Run it after a token change.
- A reviewer checks each rule in the references that no test holds. Each rule there says how it is checked.
- A change to a visible surface comes with a light and a dark screenshot of each page it changes.
