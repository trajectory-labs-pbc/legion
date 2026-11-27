# The frame and lists

Linear publishes no pixel sizes for its app; a size here is this app's choice, and a Linear size is a screenshot estimate.

## The frame (FR)

**FR1** The sidebar is 240 px wide at the left. A person can drag its edge between 200 and 320 px, and the width is kept per browser. Each row is one line, 28 px high: a 16 px icon, the label, and at the right a count. No row carries a sentence; a description goes in the row's tooltip, with the row's key. Linear: the sidebar (about 230 px and 28 px rows in its screenshots; resizable by drag). Pages: the shell. Check: (new) a shell test for the width and the drag; reviewer for one-line rows.

**FR2** The frame is an inverted L. The sidebar and the window behind the content share one colour, `bg-background`, a step darker than the content in light. The content panel is `bg-card`, inset 8 px from the window's top, right and bottom edges, with the theme's `lg` corner (`rounded-lg`, 8 px) and a 1 px `border-border` edge. No shadow. Linear: the redesign's inverted L and its dimmer sidebar. Pages: the shell; every page. Check: a shell test that the sidebar draws `bg-background`; shell screenshots in light and dark.

**FR3** The content panel's header is one row, 44 px high, with a 1 px `border-border` line under it. Left: the page's title (its `h1`: `SurfaceTitle size="group"`), the row count in `muted-foreground`, then the view tabs. Right: the list or board switch, Display, and on a record the properties panel's switch. A page adds a create button here only when the sidebar's create does not make its record. A list page has no second, larger title. Linear: the view header. Pages: every list page (Inbox, agents, project issues, priorities, machines, delivery). Check: reviewer; an axe run for one `h1`.

**FR4** Only the content panel scrolls. The frame, the sidebar and the header stay. One scroll container per column, with an unbroken `min-h-0` chain to it. Nothing scrolls sideways at 390, 768 or 1440 px, except a table wider than its column, which scrolls inside its own box. Linear: the app frame. Pages: every rebuilt page. Check: the width tests in `packages/tl-dispatch/e2e/accessibility.e2e.ts` find nothing that scrolls sideways on the fork's pages at those widths, but from 768 px they do not find content the content panel clips; (new) a browser test scrolls a long list and finds the header in place.

**FR5** `Shift+S` hides and shows the sidebar, and `[` does the same as a second key on the same command. While the sidebar is hidden, the content panel fills the window, inset 8 px on all four sides, and no rail stays. A 44 px row at the panel's top holds only the Show sidebar button, at the left, with the FR3 line under it; the view header (FR3) takes this row over later. A fold from inside the sidebar moves the focus to Show sidebar, and an unfold from Show sidebar moves it to Hide sidebar; a focus in the page stays where it is. Below 768 px the sidebar is a drawer that a header button opens. Linear: `[` collapses the sidebar (its `Shift+S` subscribes). Pages: the shell. Check: the shell tests for `Shift+S`, `[`, the folded row, the focus and the drawer.

**FR6** The sidebar lists, in order: the app's name with search and create; Inbox with its count; the person's other pages (`NAV_DESTINATIONS`); pinned records; then projects. A section heading is `Heading size="label"`, `muted-foreground`, and folds its section; the fold is kept per browser. Linear: the sidebar's order (workspace, Inbox, My issues, Favorites, teams). Pages: the shell. Check: reviewer.

## Lists (LR)

**LR1** A list row is one line, 36 px high (`h-list-row-1`). The Inbox and Answered by you rows are two lines, 56 px high (`h-list-row-2`), and no list has a third height. Nothing wraps: the title truncates with `truncate` and `min-w-0` on its flex parent, and shows a tooltip only when it is cut. No border, card or gap between rows. Linear: the issue list (about 37 to 42 px in its screenshots). Pages: Inbox, agents, project issues, priorities, machines, broadcasts, answers. Check: (new) a browser test measures the rows; reviewer.

**LR2** An issue row shows, left to right: the selection box, the priority glyph, the key (`muted-foreground`, tabular figures), the status glyph, the title (`foreground`), then at the right labels, the project, the claim or assignee avatar, and the update time (`muted-foreground`). Other records keep this order: their state glyph, their id, their title, then their metadata at the right. Linear: the issue row. Pages: every list. Check: reviewer against the row's screenshot.

**LR3** One highlight per list, shared by the pointer and the keyboard. `j` or `↓` and `k` or `↑` move it; the pointer moves it on hover. The highlighted row is `bg-secondary`. No row is highlighted when the list opens. Linear: list navigation. Check: (new) the shared list-keys test.

**LR4** Enter or a click opens the highlighted record. `$mod`+click opens it in a new tab. The whole row is the link; a control inside the row (a status glyph, a checkbox) stops the click from reaching the row. Linear: the issue row. Check: (new) tests.

**LR5** `x` selects or clears the highlighted row. Shift+click and `Shift+↓`/`Shift+↑` extend the selection; `$mod+a` selects every row. A selected row shows a checked box and `bg-muted`. With a selection, a bar at the bottom of the content panel names the count and the actions that apply; Escape clears the selection. Linear: multi-select and its bottom toolbar (Linear tints a selected row with its accent; this app does not). Pages: project issues, Inbox, agents. Check: (new) tests for each key and for Escape.

**LR6** The selection box shows when the pointer is near the row's left edge and on every row while a selection exists. A row has no other hover buttons: its actions are in its context menu, the command menu and their keys. Linear: the hover checkbox. Check: reviewer.

**LR7** A list groups by one field at a time. A group header row is 36 px (`h-list-row-1`), `bg-muted`, sticky under the view header, and shows the group's glyph, its name, its count, and at the right a `+` that creates a record in that group. A click on its fold icon, or `t` on its rows, folds the group. Empty groups are hidden unless Display shows them. The rows in a group hide the field the list groups by. Linear: grouping. Pages: project issues, Inbox, agents, priorities. Check: (new) tests for fold and sticky; reviewer.

**LR8** One Display button, or `Shift+V`, opens a popover with the view's choices: group by, order by, show empty groups, the properties a row shows (as toggle chips), and list or board. Each page keeps the person's choices in browser storage. Filters live in the URL; display choices do not. Linear: display options. Pages: every list page. Check: (new) tests; reviewer.

**LR9** Filters show as removable chips in a row under the header, one per filter, each reading field, operator and value (`Status | is | Todo | ×`), with Clear filters at the end. `f` opens the filter picker; `Alt+Shift+F` clears every filter. Linear: filters (Linear removes a filter with `Shift+F`). Pages: every list page. Check: (new) tests.

**LR10** `$mod+b` switches a list between list and board where the page has both. A board column is a status, 280 px wide; a card is the row's content on two lines, with no shadow. Linear: board layout. Pages: project issues. Check: (new) tests; reviewer.
