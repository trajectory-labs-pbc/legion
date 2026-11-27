# Records, status, inline editing and forms

A record is an issue, a document, an agent, a priority, a machine or a broadcast.

## Record view and peek (IV)

**IV1** A record's page has two columns: the main column (title, body, children, activity) and a properties panel at the right, 280 px wide, with a 1 px `border-border` edge. `Shift+M` and `]` hide and show the panel. Below 1024 px the panel moves into the header as a row of property chips. Linear: the issue view and its details pane (`]`). Pages: issue, document, agent, priority, machine. Check: screenshots at 1440 px and 800 px.

**IV2** The body text in the main column is at most 720 px wide (`max-w-180`) and centred in its column when the column is wider. A list, a board or a table uses the full width. Linear: the centred issue content. Pages: issue, document, broadcast. Check: reviewer.

**IV3** On a list, Space opens the highlighted record in a peek: a panel at the right of the content panel, 480 px wide, over the list, with the record's header, properties and body. Holding Space shows the peek only while the key is down. The list keeps the highlight and its keys: `j` and `k` move it, and the peek follows. Enter opens the record's page. Escape or Space closes the peek. The peek is in the URL, so a reload keeps it. Linear: peek. Pages: project issues, agents, priorities. Check: (new) a browser test per list: Space, `j`, Enter, Escape, and a reload that keeps the peek.

**IV4** The record's header is one row: the breadcrumb (`Project › KEY`), then at the right the position in the list it came from (`3 / 84`), previous and next buttons in the same order as `k` and `j`, and the `⋯` menu. The top of the properties panel holds the key with copy link, copy key and copy branch buttons. Facts move to the properties panel, not to more header rows. Linear: the issue view header and details pane. Pages: issue, document. Check: reviewer.

**IV5** The title is the page's `h1`, a `SurfaceTitle size="page"` (20 px, semibold) and edits in place: a click puts the cursor in it, Enter or a blur saves, Escape restores it. No Edit button and no dialog. Linear: inline title editing. Pages: issue, document, priority. Check: (new) a test for Enter, blur and Escape.

**IV6** Each property in the panel is one 32 px row: its label at the left (`Heading size="label"`, muted) and its value at the right (icon and text). An empty value reads "Add <property>" in `muted-foreground`; never "—" or "None". Linear: the details pane's label and value rows. Pages: issue, agent, machine. Check: reviewer; (new) a test renders an empty value.

**IV7** Activity is one line per event: a 14 px icon, the actor, the change, and the time at the right in `muted-foreground`. A comment is a block with the author's avatar and name. Oldest first, with the composer last. Linear: issue activity. Pages: issue, document (when the activity widget is rebuilt). Check: reviewer.

**IV8** The Inbox is a split view: the list at the left, at least 300 px wide, and the selected item at the right (`?item=`). `j` and `k` move through the list and the item follows. Linear: the split Inbox and its 300 px minimum. Pages: Inbox. Check: (new) Inbox tests.

## Status and priority (SP)

**SP1** A status shows as one 14 px glyph (`size-3.5`; `size-4` in the properties panel) whose shape follows the lifecycle: a filled disc with two arrows cut out for triage; a dashed ring for icebox and backlog, each with its own mark; an empty ring for todo; a ring with a pie a quarter, a half, three quarters and nearly full for in_progress, testing, needs_review and retro; a filled disc with a check for done. One status table holds the glyph and the label of each status in `ISSUE_STATUSES`. Linear: workflow status icons. Pages: every list, board, peek and record of an issue. Check: (new) a test renders each status and fails on a missing label or two equal glyphs.

**SP2** Status and priority glyphs are monochrome: `foreground` for the filled part and an in-progress ring. A priority's unfilled bars are `track`, a faint step 4.5:1 or more from the filled bars, so each level reads apart, as Linear's faint unfilled bars do. The dashes of no priority, and a state glyph's ring and dot before work starts (dashed or empty), are `muted-foreground`: they are the whole glyph, not a track. Colour appears only for a failed state (`danger`), a state that waits on a person (`warning`) or a passed state (`success`), and always beside an icon or a word. Linear colours each status and its urgent priority; this theme does not. Check: the design-rule tests; reviewer.

**SP3** A priority shows as bars: P0 as a filled square with an exclamation mark, P1 three filled bars, P2 two of three, P3 one of three, no priority as three short dashes. An ask's urgency uses the same glyphs: blocking as P0, high, med and low as three, two and one bars. Linear: priority icons (urgent, high, medium, low, none). Pages: lists, boards, the Inbox, records. Check: (new) a test renders each value; reviewer.

**SP4** Every status, priority and urgency glyph has a text name: its `aria-label`, its tooltip ("Status: In progress" with the key that changes it), and its label in a picker. Check: an axe run; (new) a test reads the names.

**SP5** A picker lists its values in their order (`ISSUE_STATUSES`; P0 to P3, then no priority), each with its glyph and label, the current value checked. Typing filters; `1` to `9` pick the first nine rows. In a picker of several values (labels) the chosen values sort to the top. Linear: the status and priority menus. Check: (new) a test per picker.

## Inline editing (IE)

**IE1** A property changes where it shows. A click on its glyph or text, or its key (`s` status, `p` priority, `l` labels), opens its picker in place: the search field has focus, typing filters, arrows and Enter pick, Escape closes with no change. The picker closes before the write. The new value shows at once; if the server refuses the write, the old value comes back and a toast says why, as IE5 says. Linear: property pickers on rows, cards and the details pane. Pages: lists, boards, peek, records. Check: (new) a test per property for pick, Escape and a refused write.

**IE2** Text edits in place where it shows (a title, a name, a description). A single field saves on Enter or blur and has no Save button. Escape restores the text. Linear: inline editing. Check: (new) tests.

**IE3** With a selection, a property key or picker sets the value on every selected row. A toast names the count and offers Undo, under IE5's rules. Linear: bulk edit. Pages: project issues, Inbox, agents. Check: (new) a test with three selected rows.

**IE4** A form with more than one field keeps an explicit submit: `$mod+Enter` submits it from any field, Escape closes it, and a form with changes asks first. A create form opens from the `?create=` URL key and shows its properties as a row of chips under the text fields, each opening the same picker as IE1. Linear: the create-issue form. Pages: create issue, new priority, settings sections. Check: (new) tests for `$mod+Enter` and a dirty Escape.

**IE5** Every write of a record goes through `useWrite` in `src/data/write.ts`, which owns the write's optimistic value and its failure. The caller names each query the value stands in and how the value changes it, and writes no `onMutate`, no `onError` and no cache update of its own. The write first cancels the reads already out for those queries, then shows the new value. A read, a poll or a live event that comes while the write is out waits until the write ends, so none of them shows the old value. When the write ends, either way, those queries are read again, and after a failure so is one that no view reads, and one that held nothing before the write holds nothing again, unless a newer write changed it since: this brings back the server's value, not a saved copy, so it does not undo another write of the same record. A failure shows in one toast that says what failed and why, with Retry only when a second try can work: no Retry for a 403, a 404 or a conflict that only the reader can settle. A write the reader stopped says it may have been made, and its Retry makes the same press again. Undo shows only when the write and its inverse change that one record. Only a costly write that cannot be undone asks first, in an `AlertDialog` of the UI package, never in `confirm`. A read through `useRead` in `src/data/read.ts` refuses the same way: a 403 or a 404 has no Retry, and a 404 of the page's own record shows the not-found page. A read's 409 keeps its Retry, because the conflict rule is for writes. A view that mounts on a failed read, or moves to one, shows it loading while it is read again, and shows a failure only once it has seen one. Where a page's failed reads mix a refusal with a failure that can be tried again, the Retry stays. Check: `src/data/write.test.tsx` and `src/data/read.test.tsx`; the layering table lets only `src/data` and the composition root import the query library.

## Forms (FM)

**FM1** Every field has a label that names it (`Label` with `htmlFor`). A placeholder only shows the value's shape, such as `XXXX-XXXX`; it is never the label. Pages: machine login, every form. Check: the machine login tests find the code field by its label; the axe run in `packages/tl-dispatch/e2e/accessibility.e2e.ts`.

**FM2** A server's field error shows under its field, and the field names it while it still holds the value sent: `aria-describedby` points at the error, and `aria-invalid` marks a value the server refused. A failure that says nothing of the value, such as a 401, a 403, a 429, a 5xx or a stopped send, leaves `aria-invalid` off. Pages: machine login, every form. Check: MLP-02, MLP-05 and MLP-11.

**FM3** During a submit the fields stay enabled. The pressed button shows that it is busy and keeps the focus. Another button that would write the same record waits until the write ends. Pages: machine login, every form. Check: MLP-08, MLP-09 and MLP-10.

**FM4** A field's text is 14 px, and 16 px on a coarse pointer, so a phone does not zoom in on it. A `packages/ui` field sets it itself (`pointer-coarse:text-base`), since a registry consumer has no app stylesheet; in the app, one rule in `packages/tl-dispatch/src/frame.css` sets it for upstream's fields too. The pointer sets the size, never the width. Pages: every page with a field. Check: the `Input`, `Textarea` and `Combobox` tests in `packages/ui`; the coarse-pointer field test in `packages/tl-dispatch/tests/repaint.test.ts`.
