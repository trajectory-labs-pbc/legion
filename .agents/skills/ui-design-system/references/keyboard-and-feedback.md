# Keyboard, menus and feedback

Keys come from the command catalog (`.agents/skills/commands/SKILL.md`); this file says which keys and surfaces a page owes.

## Keyboard and the command menu (KB)

**KB1** `$mod+k` opens the command menu on every page: a modal list about 640 px wide, near the top of the window, with a search field, grouped rows, and each row's key at its right. With a highlighted row, a selection or a record in view, the menu names that subject above the field and lists its commands first. Linear: the command menu, scoped to the selection and grouped by what has focus. Pages: all. Check: (new) the palette tests.

**KB2** Every action is one command in the catalog. Each surface that offers it shows its key: the tooltip, the menu row, the palette row. A page never binds a key outside the catalog. Linear: keys in tooltips and context menus. Check: the catalog's load-time checks; reviewer for a key bound outside the catalog.

**KB3** On a list, a peek or a record, one-key commands act on the selection, else the highlighted row, else the record in view: `s` status, `p` priority, `l` labels, `x` select, `$mod+Backspace` archive or delete (with a confirm when it cannot be undone). Upstream's keys stay where it has them: `a` approves on the issue page, and on the board `h` and `l` move between columns, so there labels open from the menu or the palette. Linear: issue keys (Linear's `a` assigns). Pages: project issues, Inbox, agents, priorities, the issue page. Check: (new) a test per key and subject.

**KB4** `g` then a letter goes to a page (`NAV_DESTINATIONS`); `o` opens the highlighted row's page (no key sequence starts with `o`); `c` creates the page's main record; `/` focuses search. Linear: `G` chords, `C` create, `/` search. Pages: the shell. Check: the navigation command tests.

**KB5** Copy commands: `$mod+.` copies the record's key, with upstream's `Shift+Y` as a second key; `$mod+Shift+,` copies its link, with upstream's `y`. One command holds both keys. A toast confirms the copy. Linear: `$mod+.` and `$mod+Shift+,`. Pages: lists, peek, records. Check: (new) a test for each key.

**KB6** A tooltip shows on hover after about 500 ms and at once on keyboard focus. It holds the action's name and its key, on one line. An icon-only button always has one. Linear: tooltips with key hints. Check: the HotkeyTooltip tests.

**KB7** `?` opens the shortcuts sheet, which lists every command with a key in this scope, grouped, from the catalog. Linear: the keyboard help (`?`). Check: the sheet tests.

**KB8** A toast's Undo is the only undo. `$mod+z` stays the browser's in a field and has no app command; a global undo is later work. Linear: `$mod+z` undoes almost every write and returns to its page. Check: reviewer.

**KB9** In the command menu, Right arrow on a record's row opens that record's actions as the menu's next list. Linear: the command menu's nested lists. Pages: all. Check: (new) the palette tests.

**KB10** Backspace in the command menu's empty field widens what the menu acts on, from the block or record in view to its project, as upstream's palette does. With words in the field it erases a letter. Linear: Backspace in an empty command menu steps back out of a nested list; this app keeps upstream's key. Pages: all. Check: (new) the palette tests.

**KB11** The command menu's search finds values as well as commands: "done" finds "Status > Done", which sets the subject's status. Linear: the command menu finds a status by its name. Pages: all. Check: (new) the palette tests.

## Context menus (CX)

**CX1** Right-click on a row, a board card, a link to a record or a record's header opens the record's menu: the same rows, sections and key hints as the record header's `⋯` button. Sections, in order: open, change (the property pickers first, as submenus), create, other, copy (one submenu), destructive. Linear: the issue context menu. Pages: every list, board and record. Check: (new) a test compares the two menus.

**CX2** On a selected row the menu acts on the whole selection and names its count in the first row. Linear: the context menu with a selection. Check: (new) a test with two selected rows.

**CX3** Right-click on body text or a field keeps the browser's own menu, and `Alt`+right-click always does. Linear: `Alt`+right-click. Check: (new) a test right-clicks the body text.

**CX4** A phone has no context menu. The `⋯` button opens the menu as a bottom sheet titled with the record's name. Check: reviewer on a phone.

**CX5** A separator is a direct child of the menu's content, between two rows or groups, never at a group's edge. It draws only between two rows: never first, never last, and once where two meet; a group counts as a row. The separator does this in CSS, so a row, or a whole group, that a caller leaves out leaves no stray line. A caller leaves out a group it has no rows for, label and all. Linear: menu sections divided by one line. Pages: every dropdown and context menu. Check: `packages/ui/src/components/dropdown-menu.test.tsx`.

**CX6** When one row of a menu leads with an icon, or is a checkbox, every other row and each group label keeps the icon's room, so the labels line up. The menu does this: a caller never pads a row. A row that leads with an icon marks it `data-icon="inline-start"`, as on a Button (an icon, an avatar, a dot, an image); an unmarked icon gives no room. Only a row's leading icon carries `data-icon="inline-start"`: a mark anywhere else in a row, such as a trailing badge's icon, drops that row's room and gives the room to every other row, so a trailing icon goes unmarked. A checkbox row always keeps its check's room, so an icon it holds sits after the check and its label starts later. Linear: menu labels line up whether a row has an icon or not. Pages: every dropdown and context menu. Check: `packages/ui/src/components/dropdown-menu.test.tsx`; reviewer for a leading icon without the mark, and for an `inline-start` mark on anything but a row's leading icon.

## The pointer (PT)

**PT1** Controls and links to pages of the app keep the default cursor: no `cursor-pointer` on a button, a row, a menu item, a tab or an in-app link. Only a link that leaves the app shows the pointer, which the browser gives it: no class sets it. No preference turns pointers on. Linear: no pointer cursors except on links to other sites (Linear offers a preference; this app does not). Check: the design-rule tests refuse a pointer cursor in tl-dispatch; `packages/ui`'s style test refuses it in the components.

## Empty and loading states (ES)

**ES1** An empty view shows, centred in the panel: a 32 px muted icon, a one-line title, one sentence that says why it is empty, and at most one action with its key. No illustration. Linear: empty views offer the create action (Linear draws an illustration; this theme uses an icon). Pages: every list. Check: (new) a test renders each list with no rows.

**ES2** A view whose filters match nothing says so ("No issues match these filters") and offers Clear filters. Linear: the filtered Inbox's empty state. Check: (new) a test.

**ES3** An empty Inbox says the person is done ("You have no open asks") with no action. Check: reviewer.

**ES4** While data loads, a list shows still skeleton rows at the row height, with no shimmer, and a record shows its frame; never a spinner in the middle of the panel. Show the skeleton only after about 200 ms. Check: reviewer.

## Toasts (TO)

**TO1** A toast is one line in the bottom-right corner (the shell's status corner): an icon, the text, and at most one action. A reversible write offers Undo. A toast about a moved or created record links to it. Linear: toasts with Undo and links. Pages: all. Check: the status-corner tests.

**TO2** A toast closes after 5 s, or 8 s with an action, and stays while the pointer is on it. Escape does not close it. Linear: a hovered toast stays. Check: (new) a test.

**TO3** A success or an info toast is `role="status"`; a failure is `role="alert"` and says what failed and what to do. Check: (new) a test reads the role.

**TO4** At most three toasts show at once; the oldest goes first. Check: (new) a test.

## Motion (MO)

**MO1** Row hover and highlight change with no transition, in and out. Linear: the hover with no fade-out. Check: reviewer; (new) the MO2 test.

**MO2** Motion is a fade of 150 to 200 ms, opacity only: about 150 ms for a popover, menu or tooltip, about 200 ms for a dialog, sheet or peek. An exit is a fade no longer than the entry. Check: `packages/ui`'s style test holds it for the components. In tl-dispatch, (new) a design-rule test for durations and animated properties; it must refuse `motion-safe:transition-colors`, which the design-rule test accepts today.

**MO3** No stagger on lists, no blur, no move or scale when an overlay opens, no scale on press, no bounce, no pulse or shimmer. Linear: removed its pulsing animation. Check: reviewer.

**MO4** Every animation is `motion-safe:`, so the system's reduced-motion setting stops it. Linear: reduced motion follows the system. Check: the design-rule tests.

## Focus (FO)

**FO1** Focus shows as a 2 px `outline-focus` outline, only for keyboard focus (`focus-visible`), on every control, a dialog's first field included. Linear removes the outline on its quick-create dialog; this theme does not. Check: the design-rule tests.

**FO2** A focused row draws its outline inside the row (`-outline-offset-2`), so the list does not clip it. Check: reviewer.

**FO3** Closing a menu, a picker, a dialog or a peek puts focus back on the control or row that opened it. Check: (new) a test per overlay.

**FO4** After an archive or a delete from a list, the highlight moves to the next row, else the previous one. Check: (new) a test.

**FO5** Back from a record to its list restores the highlight and the scroll position. Check: (new) a browser test.
