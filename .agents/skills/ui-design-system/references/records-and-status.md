# Records, status and inline editing

A record is an issue, a document, an agent, a priority, a machine or a broadcast. Each rule names the Linear surface it comes from, the pages it applies to, and its check. A check marked (new) is a test to write with the first page that needs it.

## Record view and peek (IV)

**IV1** A record's page has two columns: the main column (title, body, children, activity) and a properties panel at the right, 280 px wide, with a 1 px `border-border` edge. `Shift+M` and `]` hide and show the panel. Below 1024 px the panel moves into the header as a row of property chips. Linear: the issue view and its details pane (`]`). Pages: issue, document, agent, priority, machine. Check: screenshots at 1440 px and 800 px.

**IV2** The body text in the main column is at most 720 px wide (`max-w-180`) and centred in its column when the column is wider. A list, a board or a table uses the full width. Linear: the centred issue content. Pages: issue, document, broadcast. Check: reviewer.

**IV3** On a list, Space opens the highlighted record in a peek: a panel at the right of the content panel, 480 px wide, over the list, with the record's header, properties and body. Holding Space shows the peek only while the key is down. The list keeps the highlight and its keys: `j` and `k` move it, and the peek follows. Enter opens the record's page. Escape or Space closes the peek. The peek is in the URL, so a reload keeps it. Linear: peek. Pages: project issues, agents, priorities. Check: a browser test per list: Space, `j`, Enter, Escape, and a reload that keeps the peek.

**IV4** The record's header is one row: the breadcrumb (`Project › KEY`), then at the right the position in the list it came from (`3 / 84`), previous and next buttons in the same order as `k` and `j`, and the `⋯` menu. The top of the properties panel holds the key with copy link, copy key and copy branch buttons. Facts move to the properties panel, not to more header rows. Linear: the issue view header and details pane. Pages: issue, document. Check: reviewer.

**IV5** The title is a `Heading size="page"` (20 px, semibold) and edits in place: a click puts the cursor in it, Enter or a blur saves, Escape restores it. No Edit button and no dialog. Linear: inline title editing. Pages: issue, document, priority. Check: a test for Enter, blur and Escape.

**IV6** Each property in the panel is one 32 px row: its label at the left (`Heading size="label"`, muted) and its value at the right (icon and text). An empty value reads "Add <property>" in `muted-foreground`; never "—" or "None". Linear: the details pane's label and value rows. Pages: issue, agent, machine. Check: reviewer; a test renders an empty value.

**IV7** Activity is one line per event: a 14 px icon, the actor, the change, and the time at the right in `muted-foreground`. A comment is a block with the author's avatar and name. Oldest first, with the composer last. Linear: issue activity. Pages: issue, document (when the activity widget is rebuilt). Check: reviewer.

**IV8** The Inbox is a split view: the list at the left, at least 300 px wide, and the selected item at the right (`?item=`). `j` and `k` move through the list and the item follows. Linear: the split Inbox and its 300 px minimum. Pages: Inbox. Check: Inbox tests.

## Status and priority (SP)

**SP1** A status shows as one 14 px glyph (`size-3.5`; `size-4` in the properties panel) whose shape follows the lifecycle: a filled disc with two arrows cut out for triage; a dashed ring for icebox and backlog, each with its own mark; an empty ring for todo; a ring with a pie a quarter, a half, three quarters and nearly full for in_progress, testing, needs_review and retro; a filled disc with a check for done. One status table holds the glyph and the label of each status in `ISSUE_STATUSES`. Linear: workflow status icons. Pages: every list, board, peek and record of an issue. Check: a test renders each status and fails on a missing label or two equal glyphs.

**SP2** Status and priority glyphs are monochrome: `foreground` for the filled part, `muted-foreground` for the rest. Colour appears only for a failed state (`danger`), a state that waits on a person (`warning`) or a passed state (`success`), and always beside an icon or a word. Linear colours each status and its urgent priority; this theme does not. Check: the design-rule tests; reviewer.

**SP3** A priority shows as bars: P0 as a filled square with an exclamation mark, P1 three filled bars, P2 two of three, P3 one of three, no priority as three short dashes. An ask's urgency uses the same glyphs: blocking as P0, high, med and low as three, two and one bars. Linear: priority icons (urgent, high, medium, low, none). Pages: lists, boards, the Inbox, records. Check: a test renders each value; reviewer.

**SP4** Every status, priority and urgency glyph has a text name: its `aria-label`, its tooltip ("Status: In progress" with the key that changes it), and its label in a picker. Check: an axe run; a test reads the names.

**SP5** A picker lists its values in their order (`ISSUE_STATUSES`; P0 to P3, then no priority), each with its glyph and label, the current value checked. Typing filters; `1` to `9` pick the first nine rows. In a picker of several values (labels) the chosen values sort to the top. Linear: the status and priority menus. Check: a test per picker.

## Inline editing (IE)

**IE1** A property changes where it shows. A click on its glyph or text, or its key (`s` status, `p` priority, `l` labels), opens its picker in place: the search field has focus, typing filters, arrows and Enter pick, Escape closes with no change. The picker closes before the write. The new value shows at once; if the server refuses the write, the old value comes back and a toast says why. Linear: property pickers on rows, cards and the details pane. Pages: lists, boards, peek, records. Check: a test per property for pick, Escape and a refused write.

**IE2** Text edits in place where it shows (a title, a name, a description). A single field saves on Enter or blur and has no Save button. Escape restores the text. Linear: inline editing. Check: tests.

**IE3** With a selection, a property key or picker sets the value on every selected row. A toast names the count and offers Undo. Linear: bulk edit. Pages: project issues, Inbox, agents. Check: a test with three selected rows.

**IE4** A form with more than one field keeps an explicit submit: `$mod+Enter` submits it from any field, Escape closes it, and a form with changes asks first. A create form opens from the `?create=` URL key and shows its properties as a row of chips under the text fields, each opening the same picker as IE1. Linear: the create-issue form. Pages: create issue, new priority, settings sections. Check: tests for `$mod+Enter` and a dirty Escape.
