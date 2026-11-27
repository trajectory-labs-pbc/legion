# Inbox

The behaviours of upstream's Inbox page (`/`), its Reply rows (`/?type=reply`), its drawer and Answered by you (`/answers`) that the fork's Inbox keeps, each copied or rebuilt.
A row's region is one of the page's groups of behaviour, and each region has its own heading below.
A region is marked rebuilt when the fork's view draws all of it; from then each of its rows needs a test whose name starts with its ID.
A row that the fork changes on purpose is marked `changed`, with its reason as a rule of the page's design.
A row that upstream's document widget does is marked `inside`, with the full name of upstream's test that covers it.
A row of upstream's behaviour from a commit that the fork has not synced yet is marked `After next sync`, with that commit.
Where the fork changes such a row, its item gives the reason after "Changed when the sync brings it", and the sync moves the reason to the note with the mark `changed`.
An older row that such a commit makes false ends with "From" and that commit, saying what the sync changes in it.
The section "Keys" after the regions gives each key and each key conflict.
The package's README, "Checks", has the rules.

Under each heading, "View files" names the region's upstream view files, as paths under upstream's `web/src`: the region's rebuild puts them in `replacedViews` in `src/views.ts` and pins each of them whole in `tests/map/copies.json`.
"Pinned by name" names the units of upstream's view files that the fork does again for the region, each pinned by its name in `tests/map/copies.json`; a whole-file pin of the unit's file counts as its pin.
A view file that a later sync adds joins the region of the rows that name it.

## No region's view file

`features/inbox/PaneDocument.tsx` stays upstream's document widget, so it is no region's view file and stays out of `replacedViews`.

## 1. Routes and URL

| Region | Rebuilt |
| --- | --- |
| Routes and URL | no |

View files: `features/inbox/Inbox.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-1 | Routes and URL | `/` opens the Inbox page. | | |
| INB-2 | Routes and URL | `/credentials/<anything>` opens the Inbox page too (an address kept from the deleted credential record page); `/credentials/machine` is its own page and wins over that splat. | | |
| INB-3 | Routes and URL | `/replies` replaces itself with `/?type=reply` (the old Replies page is the Inbox's Reply rows). | | |
| INB-4 | Routes and URL | `/answers` opens the Answered by you page. | | |
| INB-5 | Routes and URL | `?item=<id>` selects that row and shows it in the reading pane; the id is an ask id, `reply:<thread id>` or `agent:<thread id>`. | | |
| INB-6 | Routes and URL | An `?item=` the list does not hold selects the first row and rewrites the address to it. | | |
| INB-7 | Routes and URL | An `?item=` that names a row in the folded Later band opens that band and selects the row. | | |
| INB-8 | Routes and URL | `?item=` is read only once the list has rows; a list that is loading, failed or empty leaves it unread. | | |
| INB-9 | Routes and URL | Every selection change writes `?item=` with replace, never push, so Back leaves the page in one step; selecting nothing removes `?item=`. **From `d4b15962736`:** see INB-304. | | |
| INB-10 | Routes and URL | `?agent=<session id>` narrows the list to that agent's asks and hides every thread row. | | |
| INB-11 | Routes and URL | `?section=needs-you` keeps only asks waiting on a person, not snoozed, and hides thread rows. | | |
| INB-12 | Routes and URL | `?q=<text>` is the search box's text; the list filters by the first 1000 characters, while the box shows the address as it is. | | |
| INB-13 | Routes and URL | No `?assignee=` means the reader's own list; repeated `?assignee=<email>` lists those people; `?assignee=everyone` lists everyone; `?assignee=unassigned` lists what nobody holds. Values are trimmed, lowercased and de-duplicated. | | |
| INB-14 | Routes and URL | `?show=dismissed` shows the Dismissed view; absent is the Inbox. | | |
| INB-15 | Routes and URL | `?sort=` takes `priority`, `urgency`, `type`, `project` or `assignee`; `newest` is the default and is left out. | | |
| INB-16 | Routes and URL | `?group=` takes `urgency`, `type`, `project`, `assignee`, `waiting-on` or `none`; `priority` is the default and is left out. | changed | The default is the spec's grouping of R3, "Needs you" first. A link with no `?group=` shows it, and `?group=priority` shows upstream's Priority bands. |
| INB-17 | Routes and URL | `?priority=`, `?urgency=`, `?type=` and `?project=` are comma lists; repeated parameters also read; unknown values are dropped (project takes any word); an empty field is left out. | | |
| INB-18 | Routes and URL | Every filter, sort, group, show and search change replaces the history entry instead of pushing one. The agent chip's clear is the exception: it is a link with no `replace`, so it pushes an entry. | | |
| INB-19 | Routes and URL | A plain `/` is the Inbox as it opens: every field at its default is absent from the address. | | |
| INB-20 | Routes and URL | Answered by you rows link to each ask's own page (`row.ref`); owner links use the owner's page. | | |
| INB-329 | Routes and URL | `?item=` naming a thread row whose read lands after the asks' selects that row, not the first. While a pointer moves over the list, it keeps that row until the pointer settles, and then selects it. Below 1280 px, a reload onto such a row opens it, with its way back. | After next sync | d4b15962736 |

## 2. Page frame, title and counts

| Region | Rebuilt |
| --- | --- |
| Page frame, title and counts | no |

View files: none.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-21 | Page frame, title and counts | The tab title is `Inbox · Dispatch`. | | |
| INB-22 | Page frame, title and counts | The page heading is "Inbox", with an "Answered by you" link at the right to `/answers`. The drawer has no such link. | changed | R2: Answered by you becomes the Inbox's second tab, in the view header. |
| INB-23 | Page frame, title and counts | From 1280 px wide the page fills the viewport and the list and the reading pane each scroll in themselves; below 1280 px the document scrolls. **From `d4b15962736`:** Below 1280 px, with a row that the reader opened, the page fills the viewport too, and the open row's view scrolls in its own box. | | |
| INB-24 | Page frame, title and counts | The header above the list (search box, Filter bar, banner, refusal line, bulk bar) stays mounted whether or not any row is listed, so typing a letter that empties the list keeps the focus in the search box. | changed | R6: the header above the list no longer holds the selection bar, which is at the bottom of the list column. |
| INB-25 | Page frame, title and counts | The Inbox count in the sidebar and the compact header is the work waiting on the reader (open asks whose turn is theirs, not snoozed, plus pending credential requests) plus their unread thread rows. It is 0 until the login resolves. | | |
| INB-26 | Page frame, title and counts | The unread thread count is one `GET /api/v1/me/replies?kind=reply,agent&limit=1` per page load, asked only for a signed-in person. | | |
| INB-27 | Page frame, title and counts | On the Inbox page the count is plain text; elsewhere it links to `/`, and the compact header adds a "Peek" button that opens the drawer. | | |

## 3. List states

| Region | Rebuilt |
| --- | --- |
| List states | no |

View files: none.
Pinned by name: `emptyStateMessage` in `features/inbox/Inbox.tsx`.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-28 | List states | While the inbox read or the login is pending, the page shows a skeleton labelled "Loading your inbox". | | |
| INB-29 | List states | When the inbox read fails, or the login does not resolve, the page says "Could not load your inbox." | | |
| INB-30 | List states | Empty because of typed text: "Nothing matches this text" (this wins over every other reason). | changed | R15 (rule ES1): the empty list adds the sentence "No row holds the text in the search box.", and Clear filters (`Alt+Shift+F`) when a filter is also set (rule ES2). |
| INB-31 | List states | Empty Dismissed view: "Nothing dismissed". | changed | R15 (rule ES1): the empty list adds the sentence "Threads that you dismiss show here.". |
| INB-32 | List states | Empty under an agent filter: "No open asks from <agent>", with the agent named in plain text, and the clear link still shown. | changed | R15 (rule ES1): the empty list adds the sentence "New asks from this agent show here.", and its action is Clear filters (`Alt+Shift+F`). |
| INB-33 | List states | Empty own list: "Nothing needs you"; empty cleared filter: "Nothing needs anyone"; empty other selection: "Nothing matches this filter". | changed | A filter of another field also gives "Nothing matches this filter", as rule ES2 asks. Each case adds the sentence and the action of the spec's table "Empty lists" (R15). |
| INB-34 | List states | The page says nothing is empty while credential requests are loading, failed, or still wait on a decision; a list holding only expired requests still says "Nothing needs you". | | |
| INB-35 | List states | An empty list shows no reading pane, except for a question the pane keeps because the reader has an unsent answer in it. | | |
| INB-36 | List states | Offline or with the live feed broken, the list keeps its last data; the shell's connection pill says "Reconnecting…" or "Live updates are not reaching this page" with Reload. A gap in the feed reads the lists again once. | | |
| INB-37 | List states | With no secrets broker, the credential list is asked once per load, and a focus, a stream refresh or a return to the Inbox neither asks again nor hides the empty state. | | |

## 4. List rows

| Region | Rebuilt |
| --- | --- |
| List rows | no |

View files: `features/inbox/ThreadRowCard.tsx`, `features/inbox/ThreadTitle.tsx`, `features/inbox/RowMarks.tsx`, `features/inbox/AskOwnerLink.tsx`, `features/inbox/DismissControl.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-38 | List rows | The list holds two kinds of row: open asks (question, decision, approval) and the reader's own threads (Reply, Agent message). | | |
| INB-39 | List rows | From 1280 px each row is short: a mark box, a kind icon, the title (an ask's first question line with Markdown removed, or a thread's subject), the age at the right; under it the priority tag, the urgency mark and the owner link. **From `d4b15962736`:** see INB-302. | changed | R2 and R3 (rules LR7 and TY5): one two-line row, 56 px high, at every width, with a 36 px avatar, the title at weight 500 and the time at the right of line two. The priority is in the row's tooltip and in the reading pane's head, and an ask's urgency shows as bars. |
| INB-40 | List rows | Below 1280 px an ask row is its whole card under a control line: mark box, kind icon, owner link, the "<agent> replied" chip, urgency, priority, Assign to me, Snooze. **From `d4b15962736`:** see INB-302. | changed | R2: one row at every width. Below 1280 px, an ask's row is the two-line row with no card, and it opens in the 480 px peek. |
| INB-41 | List rows | Below 1280 px a thread row is its mark box over the thread's card. **From `d4b15962736`:** see INB-302. | changed | R2: one row at every width. Below 1280 px, a thread's row is the two-line row with no card, and it opens in the 480 px peek. |
| INB-42 | List rows | The "<agent> replied" chip shows on an ask waiting on a person whose last reply is an agent's. **From `d4b15962736`:** see INB-327. | | |
| INB-43 | List rows | The kind icon is a glyph with a text name: `?` Question, `◆` Decision, `✓` Approval, `↩` Reply, `✦` Agent message. | changed | R2: the row's kind is a badge on its 36 px avatar. |
| INB-44 | List rows | The priority tag shows `P0`–`P3` from the owning issue; a row with no issue or no priority shows none. | changed | R3: the issue's priority is in the row's tooltip and in the reading pane's head, not on the row. |
| INB-45 | List rows | The urgency mark shows Blocking, High, Medium or Low for an ask; a thread row shows none. | changed | R3 (rule LR7): an ask's urgency shows as bars, and a row in an urgency group shows none. |
| INB-46 | List rows | An ask's age reads in minutes below one hour, hours below two days, then days; a thread's time is the shared relative timestamp ("just now"). Both carry a `<time datetime>`. | | |
| INB-47 | List rows | The whole short row is the click target for selection; a click on a link, button, input, label, select or text area inside it is that control's and does not select. | | |
| INB-48 | List rows | The selected short row is drawn with the selected background and `aria-current="true"`. | | |
| INB-49 | List rows | A thread's short row title is a link to the thread itself; unread threads are bold with an "Unread" dot. | changed | R3 (rule TY5): each row's title has weight 500. A thread keeps its unread dot, and an ask has none. |
| INB-50 | List rows | A thread row with a reference shows a copy-reference button; an Agent row, and a message thread on a project document, have none. | | |
| INB-51 | List rows | A thread's short row shows Dismiss on the selected row always and on other rows only while hovered or focused. **From `d4b15962736`:** Dismiss always shows on a device with no hover or with any coarse pointer, at every width. | | |
| INB-52 | List rows | Two asks of one owner get ordinals in the order they are drawn ("ask 1 of 2"), and a folded twin leaves the visible row with the short name. | | |
| INB-53 | List rows | An artifact-owned ask is labelled with its project and a link to the document page. | | |
| INB-54 | List rows | A thread whose root its author deleted reads as the deleted line (italic) in the row title, the mark box name and the Dismiss name; an edited root shows " · edited" after the title. | | |
| INB-296 | List rows | A short row's title is the question drawn by the shared Markdown renderer on one line: the heading's words and the detail after them, cut to the row, with no Markdown syntax left. | | |
| INB-297 | List rows | The controls of an ask's row are named with the question's plain-text reading: a mention or a reference reads as its target's name, and a `#id` names the question of the ask's document. | | |
| INB-302 | List rows | Below 1280 px the list shows short rows too, and a cut text carries its whole text as a title: an ask's question and an Agent row's session. | After next sync | d4b15962736 |
| INB-303 | List rows | At each width, an issue owner's link opens the issue's hover card, has no title, and cuts only the issue's title, never its key; a document owner's link opens the document's hover card and has no title; an Agent row's owner opens no hover card and carries its whole session name as a title. | After next sync | d4b15962736 |
| INB-334 | List rows | A click on a short row's owner link opens the ask inside its issue, and the row leaves `?item=` as it is. | | |
| INB-335 | List rows | A thread row's title draws the stored references in its subject as their targets' names. | | |
| INB-336 | List rows | A row control's name is "<owner>: <question>", with ", ask i of n" after the owner when it has an ordinal; the question's line breaks and runs of spaces collapse to single spaces, and a question past 48 characters is cut with no trailing space and ends in an ellipsis. | | |
| INB-337 | List rows | A deleted root's line ends in an ellipsis inside the row's title, however long the deleting name. | After next sync | d4b15962736 |

## 5. Bands, sort and paging

| Region | Rebuilt |
| --- | --- |
| Bands, sort and paging | no |

View files: `features/inbox/InboxGroups.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-55 | Bands, sort and paging | The list is banded by the Group by field (default Priority); bands are in the field's own order (P0 first, Blocking first, Question to Agent message, project and person by text), "none" last. | changed | With no `?group=`, the list groups by "Needs you" first and then by urgency (R3 of the spec). Priority stays a choice of Display's Group by. |
| INB-56 | Bands, sort and paging | Waiting on bands are "Waiting on you", "Waiting on agents" and "Later"; for any list but the reader's own, the first reads "Waiting on a person". A thread row waits on the reader. | changed | R3: by default the first group is "Needs you": the pending credential requests, then the rows of this band. On the reader's own list its header is the "Needs you" mark, and on each other list it reads "Waiting on a person". Each other ask is in a group by its urgency, and the snoozed asks are last, in Later. |
| INB-57 | Bands, sort and paging | An ask whose turn is a person's sits under Waiting on you; an agent's progress note keeps it under Waiting on agents; no row is drawn twice. | changed | R3: an ask whose turn is a person's and that is not snoozed is in "Needs you", and each other ask is in a group by its urgency. |
| INB-58 | Bands, sort and paging | Group by None draws one band with no heading. | | |
| INB-59 | Bands, sort and paging | Under every grouping a snoozed ask goes to the Later band, last; once its moment passes it is an ordinary row again on the next render. | | |
| INB-60 | Bands, sort and paging | A band heading reads "<name> (<count>)" and is a fold toggle; Later starts folded. | changed | R12 (rule LR7): a group header is 36 px high, on the one-line row token, and sticky, and `t` folds its group. |
| INB-61 | Bands, sort and paging | Folds are kept per Group by value in the browser (`dispatch.inbox.folded-groups:<login>`, JSON of band keys per grouping); from the first fold the reader's set replaces the default; a broken value falls back to the default. The page and the drawer share it. | | |
| INB-62 | Bands, sort and paging | A folded band draws no rows, except a row whose own snooze write is still out, so "Snoozing…" and a refusal stay visible. | | |
| INB-63 | Bands, sort and paging | Sort (default Newest first) orders by the chosen field with "none" last, ties newest first, then by row id. Newest is the row's last reply, else its creation. Within a band the sort holds. | | |
| INB-64 | Bands, sort and paging | A band draws 50 rows; "Show N more in <band>" adds the next 50. | | |
| INB-65 | Bands, sort and paging | The Dismissed view keeps the server's order (newest dismissal first), has no bands, and its "Show 200 more" reads the next page from the server ("Loading…" while it reads). | | |
| INB-66 | Bands, sort and paging | A row that moves band keeps its DOM node (one keyed list with headings as items), so its draft, disclosures and focus survive the move. | | |

## 6. Search

| Region | Rebuilt |
| --- | --- |
| Search | no |

View files: none.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-67 | Search | A search box above the Filter bar ("Issue, title, question or author") narrows the list as the reader types; its tooltip says "At most 1000 characters". | changed | R9: the search box is the first item of the filter row, and `/` moves the focus to it. |
| INB-68 | Search | Every typed word must match, in any order and any case; an empty query matches every row. | | |
| INB-69 | Search | An ask matches on its issue key, issue title, the document name only where it has no issue, the question (an approval's generated prefix included) and the author as the ask carries it. | | |
| INB-70 | Search | A Reply row matches on its issue, document (no issue), subject and last writer; an Agent row matches on the session id and its known name. | | |
| INB-71 | Search | A keypress that does not change the capped text writes nothing to the address. | | |
| INB-72 | Search | A row held under the reader's hand stays while the server changes its text out of the typed search, keeps its half-typed answer and focus, and goes once the reader types more words. | | |
| INB-73 | Search | The search applies to Mark all read and Select all: under typed text neither sends the list's narrowing to the server. | | |
| INB-338 | Search | The search narrows only the rows: the credential requests and the banner do not change with the search text. | | |

## 7. Filter bar and View menu

| Region | Rebuilt |
| --- | --- |
| Filter bar and View menu | no |

View files: `features/inbox/InboxBar.tsx`, `features/inbox/ViewMenu.tsx`, `features/inbox/AssigneeFilter.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-74 | Filter bar and View menu | "Filter" at the left of the bar toggles a row of five field controls: Priority, Urgency, Type, Project, Assignee. | changed | R10 (rule LR9): the Filter button and `f` open one Filter picker, with the fields first and then the chosen field's values and their counts. Escape closes it and moves the focus back to its opener, and a reload closes it. |
| INB-75 | Filter bar and View menu | Each field is a searchable multi-select; each value shows how many rows it holds, counted under the other fields' filters, so a ticked value never empties the list by surprise. | | |
| INB-76 | Filter bar and View menu | Values are listed in order: Priority P0–P3 then No priority; Urgency most urgent first then No urgency; Type Question, Decision, Approval, Reply, Agent message; Project the keys on the rows sorted, then No project. A value the address carries but no row has is still listed. | | |
| INB-77 | Filter bar and View menu | Only one bar popover is open at a time (a field, Assignee or View). | | |
| INB-78 | Filter bar and View menu | A multi-select's search moves with ArrowDown and ArrowUp, toggles with Enter, closes with Escape or Tab, and says "No matching <field>." when nothing matches. | | |
| INB-79 | Filter bar and View menu | The Assignee trigger names the selection: "Assignee · you", "· everyone", "· Unassigned", one email, or a count. | | |
| INB-80 | Filter bar and View menu | The people list is read on the first open only and then kept; it lists Unassigned first, then logins, and marks the reader's own row "you". | | |
| INB-81 | Filter bar and View menu | The people search says "Loading people…" while the read is out and "No matching person." when it matches nobody; a failed read says "Could not load the people list." and the filter keeps working from the address; a selected person not in the list is still a row. | | |
| INB-82 | Filter bar and View menu | Picking another person lists their questions under "Waiting on a person". | | |
| INB-83 | Filter bar and View menu | Each active filter is a removable token ("Priority: P1 ×", "Assignee: everyone ×"); a click removes that one value. | changed | R10 (rule FO3): a chip shows only for a filter that is set, as "field \| operator \| value \| ×". |
| INB-84 | Filter bar and View menu | The `?agent=` token reads "Asks from <agent> · clear" (with " waiting on you" under `?section=needs-you`); a click clears the agent and keeps assignee, item and search. The clear is a link, so it pushes a history entry. **From `d4b15962736`:** The clear link keeps the history entry's mark that the column chose the row by itself. | changed | R10 (rule FO3): the agent filter shows as a chip, "field \| operator \| value \| ×". |
| INB-85 | Filter bar and View menu | "Clear filters" appears with any token and clears the agent, the section, the four fields and the assignee filter (back to the reader's own list). Sort, group, show and search stay. | changed | R10: Clear filters (`Alt+Shift+F`) follows the chips. |
| INB-86 | Filter bar and View menu | "View" at the right opens a menu with four radio sections: Sort by (Newest first, Priority, Urgency, Type, Project, Assignee), Group by (Priority, Urgency, Type, Project, Assignee, Waiting on, None), Show (Inbox, Dismissed) and Thread order (Oldest first, Newest first). | changed | R3: the View menu becomes Display. Its Group by keeps each of upstream's groupings, and with no `?group=` the list shows the new default grouping. |
| INB-87 | Filter bar and View menu | The View menu closes on Escape (focus back to View), on a press outside it, and on its trigger. | | |
| INB-88 | Filter bar and View menu | Thread order is kept in the browser (`dispatch.inbox.thread-order:<login>`) and applies to every thread in Dispatch, not only the Inbox. | | |
| INB-89 | Filter bar and View menu | Show › Dismissed lists only thread rows the reader dismissed; an ask is never dismissed. | | |
| INB-90 | Filter bar and View menu | "Mark all read" sits between Filter and View and shows only while the list holds an unread Reply or Agent row the press would mark (no typed text, not the Dismissed view). | | |
| INB-91 | Filter bar and View menu | Mark all read sends the list's filters and its read mark, zeroes the count and draws the rows read at once without removing any; it asks nothing first. | | |
| INB-92 | Filter bar and View menu | A refused Mark all read brings the rows and counts back and says "Nothing was marked read."; a stopped one reads the list again and says the mark may have been saved; the word goes when the reader narrows the list another way. | | |
| INB-93 | Filter bar and View menu | A read of the list or the count asked while Mark all read is out waits for its answer and never puts back what the press drew read; a thread somebody starts meanwhile shows once the press's event arrives. | | |
| INB-339 | Filter bar and View menu | A row's assignee is the ask's `asked_of`, else the issue's assignee, else the project's default assignee. | | |

## 8. Banner and credential requests

| Region | Rebuilt |
| --- | --- |
| Banner and credential requests | no |

View files: `features/inbox/BlockedOnYou.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-94 | Banner and credential requests | Above the list, "Blocked on you: N item(s), oldest <age>" counts the reader's own waiting asks that are not snoozed and the pending credential requests; it hides at zero, under an agent filter and in the Dismissed view; it links to `/`. | changed | R3: the banner's duties move into the list. "Needs you" holds the pending credential requests and the asks whose turn is a person's, and its header mark alone says that a row needs the reader. |
| INB-95 | Banner and credential requests | A request whose time cannot be read still counts but is never the oldest; an expired request is neither counted nor the oldest. | | |
| INB-96 | Banner and credential requests | Credential requests are listed above the search box. A pending secret request links to its broker page, a pending machine request links to `/credentials/machine`, and a secret request with no usable approve link shows its summary with no link. An expired one is marked Expired, says when its deadline passed, links nowhere and offers Dismiss. The section draws nothing while it loads or with no request, and shows "Couldn't load credential requests." only when no list ever loaded. | changed | R3: the pending credential requests are the first rows of "Needs you", and the list's keys reach them. |
| INB-340 | Banner and credential requests | A credential request's line names its session. A running session's title links to its live conversation, an id that the agents list does not carry reads as not running, and the session reads as unknown while the agents list cannot be read. When both ids show, only the enrollment line carries the "came from" preamble, and a request-only session id has no preamble. | | |
| INB-341 | Banner and credential requests | A credential request that the broker records after the page loaded is listed and counted with no reload, and one that leaves the broker leaves the list and the count the same way. | | |
| INB-383 | Banner and credential requests | The credential requests are listed in the header above the list, which stays mounted whether or not any row is listed. | changed | Split from INB-24. R3: the pending credential requests are the first rows of "Needs you". |

## 9. Selection and the bulk bar

| Region | Rebuilt |
| --- | --- |
| Selection and the bulk bar | no |

View files: `features/inbox/BulkBar.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-97 | Selection and the bulk bar | Every row (ask or thread) has a mark box named "Select <row name>"; a click marks the row without selecting it or writing the address. | changed | Rule LR6: the selection box shows in the avatar's place on hover and on focus, and on each row while a selection exists. |
| INB-98 | Selection and the bulk bar | Marks are kept by row id; a mark whose row has left both reads drops out, so a row that comes back is unmarked; a mark on a row in a folded band or behind Show more stays but is not counted or acted on. | | |
| INB-99 | Selection and the bulk bar | While a mark is on the page, a snooze is out, or a refusal stands, a bulk bar shows above the bands: "N selected" (or "Every row selected", or "Snoozing N…"), Snooze… for the asks, Dismiss (or "Move to Inbox" in the Dismissed view) for the threads, Select all, Clear selection. | changed | R6: the selection bar is at the bottom of the list column, over the list, and the list can scroll its last row above it. It offers Snooze (`h`), Mark read (`u`), Dismiss (`e`), Select all (`$mod+a`) and Clear (Escape). |
| INB-100 | Selection and the bulk bar | The bulk Snooze picker offers the snooze presets; one pick snoozes every marked ask the view draws; a second pick while one is out does nothing (the picker stays focusable). | | |
| INB-101 | Selection and the bulk bar | A bulk snooze moves the rows to Later at once; asks the server took leave the selection, refused ones stay marked; the bar says "Could not snooze K of N: <reason>." (with "and M other reasons"), and a stopped one says it may have been saved and stays marked. | | |
| INB-102 | Selection and the bulk bar | Select all marks every row the narrowing matches, folded and paged rows included; the bar says "Every row selected"; any mark change ends it. | changed | R6: Select all is an action of the selection bar, on `$mod+a`. |
| INB-103 | Selection and the bulk bar | Bulk Dismiss names every selected thread by id with what the page drew in it; in the paged Dismissed view a Select all sends the list's narrowing and its read mark instead. The marks clear at once. | changed | R6 and R14: a bulk dismiss that Dispatch takes, in whole or in part, shows one toast with Undo, which counts the threads that it changed (INB-331). After Select all in the Dismissed view, the Move to Inbox has no Undo. |
| INB-104 | Selection and the bulk bar | A list-wide write (Mark all read, Select all Dismiss) carries the list's narrowing: kind, priority, project and urgency, never assignee. A Type filter of ask types only offers neither. An Agent row is in scope only when every filter admits a row with no value. | | |
| INB-105 | Selection and the bulk bar | Clear selection (button) clears the marks, Select all and the standing refusal. | | |
| INB-106 | Selection and the bulk bar | The bar stays while its own write is out, even after the write emptied the view, so its refusal has somewhere to land. | | |
| INB-312 | Selection and the bulk bar | A short row's checkbox marks the row without opening it, and takes a press anywhere in a 44 px square around the box, at every width. Below 1280 px, `x` marks the row that the reading view shows. | After next sync | d4b15962736 |
| INB-331 | Selection and the bulk bar | A bulk Dismiss or Move to Inbox that Dispatch takes, in whole or in part, shows one toast with Undo that counts the threads that it changed ("Dismissed 12", "Moved 4 to the Inbox"). Undo, by its button or `Shift+Z`, sends the same rows back and does not select them again. | changed | R6 and R14: upstream has no Undo after a bulk write. |
| INB-332 | Selection and the bulk bar | A bulk Snooze that Dispatch takes, in whole or in part, shows one toast with Undo that counts the asks that it took ("Snoozed 3"). Undo gives each of those asks back its earlier snooze time, or un-snoozes it when it had none or its time has passed. | changed | R6 and R14: upstream has no Undo after a bulk write. |
| INB-333 | Selection and the bulk bar | After Select all in the Dismissed view, a Move to Inbox shows no Undo, and a press that Dispatch took for no row shows no toast. A refused or unconfirmed Undo shows one toast with Retry or Try again, and Retry sends only the writes that failed. | changed | R6 and R14: upstream has no Undo after a bulk write. |
| INB-342 | Selection and the bulk bar | A marked row that the search hides leaves the bar's count, and comes back marked when the search shows it again. | | |
| INB-343 | Selection and the bulk bar | A late bulk-snooze refusal marks again only the row that it refused, also after Clear or Escape cleared the marks. | | |

## 10. Keys on the list

| Region | Rebuilt |
| --- | --- |
| Keys on the list | no |

View files: none.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-107 | Keys on the list | `j` moves to the next row and `k` to the previous; with the pane on they move the selection (and the address), else the focus. From inside the pane they first return focus to the selected row. Not in the palette. | | |
| INB-108 | Keys on the list | `j` enters a band at its first row and `k` at its last, never on a heading. | | |
| INB-109 | Keys on the list | ArrowDown and ArrowUp move like `j`/`k`, but with the pane on only while the focus is in the list (in the pane they scroll or move options). | | |
| INB-110 | Keys on the list | Enter moves the focus into the answer box of the row in hand; in the pane, on a compact decision card, it opens "Add a note or answer in your own words" first. It fires from a row or from nothing focused; a focused link or button keeps Enter. **From `d4b15962736`:** see INB-305. | changed | R4 and R8 (rule LR4): on an open ask, Enter moves the focus to the first option, picks an option, or sends. On each other row, it opens the row in the pane from 1280 px, and in the peek below. Below 1280 px, Enter on an open ask opens the peek with the focus on the first option. An ask that upstream's document in the pane still draws keeps upstream's Enter, and below 1280 px it opens the peek with the focus in the card's answer box (R12). |
| INB-111 | Keys on the list | `1`–`9` pick option 1–9 of the row in hand's own card (not the first block of the document). | | |
| INB-112 | Keys on the list | `o` opens the row in hand's issue, document or thread (its owner link, or the pane head's Open page). | | |
| INB-113 | Keys on the list | `y` copies the row in hand's reference; it does nothing on an Agent row. | | |
| INB-114 | Keys on the list | `x` marks or unmarks the row in hand (ask or thread). Not in the palette. | | |
| INB-115 | Keys on the list | `e` dismisses the thread row in hand (or moves it back to the Inbox in the Dismissed view); it does nothing on an ask, and nothing from inside an ask card in the pane. | | |
| INB-116 | Keys on the list | `h` with marks focuses the bulk Snooze picker; without marks it focuses the row's (or the pane head's) Snooze. It stands down inside an ask card. | | |
| INB-117 | Keys on the list | `l` moves the focus into the reading pane's scroller and remembers the row it came from (only if nothing is remembered); it works only with the pane on and a row selected. **From `d4b15962736`:** see INB-307. | | |
| INB-118 | Keys on the list | Escape from inside the pane returns the focus to the row `l` remembered, else to the selected row. | | |
| INB-119 | Keys on the list | The remembered row is dropped when the pane shows another question, when the pane closes, or when the focus lands outside the pane (search box, a row, a click in the list, a dialog); a window blur or an unmount inside the pane keeps it. | | |
| INB-120 | Keys on the list | Escape on a focused row blurs it; from a control inside a row it focuses the row first. | | |
| INB-121 | Keys on the list | Escape in the bulk Snooze picker returns to the row `h` was pressed on, else the first row, else the bar. **From `d4b15962736`:** see INB-347. | | |
| INB-122 | Keys on the list | Escape with no row focused clears the selection exactly while the bar's Clear is offered, a bulk snooze still out and a standing refusal included. It stands down while a bar popover is open (that Escape closes the popover only). Not in the palette. | | |
| INB-123 | Keys on the list | `f` focuses the search box from anywhere on the page; typed in the box, `f` is a letter. **From `d4b15962736`:** see INB-346. | changed | Key conflict KC1, R9 and R10 (rules KB4 and LR9): `/` moves the focus to the search box, and `f` opens the Filter picker. No command registers `$mod+f`, so it stays the browser's find. |
| INB-124 | Keys on the list | Escape in the search box returns to the selected row, or the first row. | changed | Key conflict KC2 and R9: in the search box, Escape clears the text when the box has text. In an empty box, it moves the focus back to the row. |
| INB-125 | Keys on the list | `i` (shell) opens or closes the inbox drawer on every page but the Inbox; `g i` (shell) goes to the Inbox. | | |
| INB-126 | Keys on the list | The shortcut sheet and the palette name each key by its label with the row word "selected" while the reading column shows and "focused" otherwise, as in "Answer the selected ask", "Select option 1–9 of the focused ask", "Copy the selected row's reference" and "Select or deselect the focused row". | | |
| INB-306 | Keys on the list | Below 1280 px, Enter that opens an ask's row leaves the focus where the next Enter reaches the answer box. **Changed when the sync brings it:** R4 and R8: on an ask's row with no pick, Enter opens the peek with the focus on the first option. | After next sync | d4b15962736 |
| INB-307 | Keys on the list | Below 1280 px, `l` moves the focus into the open row's view, and does nothing with no row open. | After next sync | d4b15962736 |
| INB-313 | Keys on the list | Below 1280 px, Escape in the reading view's answer box is the box's. Escape on an answer option steps out to the view and keeps the pick, and the next Escape goes back to the list. **Changed when the sync brings it:** R8: in the peek, one Escape closes the peek and returns the focus to its row. | After next sync | d4b15962736 |
| INB-315 | Keys on the list | Below 1280 px, `h` on a focused ask row with no marks opens its view at the head's Snooze. `h` on a snoozed row opens nothing, and leaves no Snooze for a later row to take the focus to. | After next sync | d4b15962736 |
| INB-316 | Keys on the list | Below 1280 px, `y` on a focused ask row opens the row and copies its reference from its head. | After next sync | d4b15962736 |
| INB-317 | Keys on the list | Below 1280 px, `1` to `9` on a focused ask row that has options and is not an approval open the row and press that option there. When the ask has no such option, the view opens with the focus on its scroller. On other rows the keys do nothing. | After next sync | d4b15962736 |
| INB-323 | Keys on the list | Below 1280 px, with rows marked, `h` reaches the selection bar while a row is open. | After next sync | d4b15962736 |
| INB-325 | Keys on the list | Below 1280 px, `o` on a focused thread row goes to the thread's own page, not to the row's view. | After next sync | d4b15962736 |
| INB-344 | Keys on the list | The list's keys work while a checkbox that the pointer ticked holds the focus. | | |
| INB-345 | Keys on the list | The shortcut sheet (`?`) lists `l` and `f` under Inbox only. | | |
| INB-346 | Keys on the list | Below 1280 px, `f` does nothing while a row's reading view is open, because the search box is hidden with the list. | After next sync | d4b15962736 |
| INB-347 | Keys on the list | Below 1280 px, in an open reading view, Escape in the bulk Snooze picker moves the focus to the view's scroller, else to the bar. | After next sync | d4b15962736 |
| INB-348 | Keys on the list | Below 1280 px, `j` and `k` step the row that the open reading view shows. | After next sync | d4b15962736 |

## 11. Reading pane: selection and divider

| Region | Rebuilt |
| --- | --- |
| Reading pane: selection and divider | no |

View files: `features/inbox/PaneDivider.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-127 | Reading pane: selection and divider | From 1280 px (`min-width: 80rem`) the page is a list and a reading pane side by side; below it there is no pane, no selection and no `?item=`. **From `d4b15962736`:** see INB-304. | changed | R2 gives one row at every width: below 1280 px, the open row shows in the peek and `?item=` names it. |
| INB-128 | Reading pane: selection and divider | The Inbox selects the first row when it opens with the pane on. | | |
| INB-129 | Reading pane: selection and divider | A click on a short row selects it and the pane shows it. | | |
| INB-130 | Reading pane: selection and divider | The selected row is scrolled into view (nearest) as the reader walks the list. | | |
| INB-131 | Reading pane: selection and divider | When the selected row leaves the list (answered, snoozed, dismissed, dropped by the server) the selection moves to the row below where it stood, else the one above, else nothing. | | |
| INB-132 | Reading pane: selection and divider | The reader's own answer takes the row off the list and selects the next one when the server records it. | | |
| INB-133 | Reading pane: selection and divider | A question the reader typed an unsent answer into stays in the pane after its row goes, until they select another row; a question whose answer is still out stays until the server decides it. | | |
| INB-134 | Reading pane: selection and divider | `j`/`k` from a question kept past its row step from the place the row held, not from the top. | | |
| INB-135 | Reading pane: selection and divider | The pane starts at 60 % of the two columns. A divider between them resizes it from 30 % to 80 %: drag, or ArrowLeft/ArrowRight (left widens the pane); double-click puts it back to 60 %. | changed | R2: the list keeps at least 300 px. |
| INB-136 | Reading pane: selection and divider | The divider width is kept in the browser (`dispatch.inbox.pane-width:<login>`) and read back clamped on the next load. | | |
| INB-137 | Reading pane: selection and divider | The divider is a separator named "Resize reading pane" with its value between 30 and 80. | | |
| INB-304 | Reading pane: selection and divider | Below 1280 px, a row that the reader opens is read full width in place of the list, under "← Inbox". "← Inbox", the browser's Back and Escape go back to the list at that row. **Changed when the sync brings it:** R2 (rules LR4 and IV3): the row opens in the 480 px peek over the list, and Escape or Space closes the peek. Opening it pushes a history entry, as `open` of upstream's `pane-selection.ts` does from this commit, so Back closes it. | After next sync | d4b15962736 |
| INB-305 | Reading pane: selection and divider | Below 1280 px, Enter opens the focused row. A plain click on a thread row's title opens the row in place, and a modified click follows the link. | After next sync | d4b15962736 |
| INB-308 | Reading pane: selection and divider | Below 1280 px, the way back from an opened row stays after the browser's Back, a reload, a change of width, a search typed over the open row, and a cleared agent filter: "← Inbox" goes back through the history entry that the open pushed. | After next sync | d4b15962736 |
| INB-309 | Reading pane: selection and divider | Beside the reading column, the browser's Back over a row opened below 1280 px goes back past it. | After next sync | d4b15962736 |
| INB-310 | Reading pane: selection and divider | A row that the reading column chose by itself, or handed its own pick on to, is not a row that the reader opened, so narrowing the window shows the list. A search typed beside the column keeps the column's pick, and narrowing then leaves the focus in the search box. | After next sync | d4b15962736 |
| INB-311 | Reading pane: selection and divider | When the window narrows below 1280 px, the row that the reader opened in the reading column is read in place of the list. **Changed when the sync brings it:** R2: `?item=` names the open row at every width, and below 1280 px the row opens in the peek. | After next sync | d4b15962736 |
| INB-318 | Reading pane: selection and divider | Below 1280 px, an answer, a snooze or a dismiss of the open row, or the reader's own Assign to me under Unassigned, opens the next row: the row below, else the row above. After the last row, the list is back and its keys work, with no line that the item left. **Changed when the sync brings it:** R5: after a bulk write that takes the row below, the peek shows the column's row; the drawer's item view closes. | After next sync | d4b15962736 |
| INB-319 | Reading pane: selection and divider | Below 1280 px, an open row that leaves the Inbox by itself brings the list back at its place, with the line "This item left your Inbox." until the next key or click, or a window 1280 px wide. A row that leaves only the list's filter brings the list back with no such line. | After next sync | d4b15962736 |
| INB-320 | Reading pane: selection and divider | Below 1280 px, an open row that the reader's own Assign to me left in the list, and that is withdrawn later, brings the list back with the line "This item left your Inbox.". | After next sync | d4b15962736 |
| INB-321 | Reading pane: selection and divider | The way back has the accessible name "Back to the Inbox list", and the line "This item left your Inbox." is a live region that is always there. | After next sync | d4b15962736 |
| INB-322 | Reading pane: selection and divider | The checkbox beside "← Inbox" ticks the open row, as the row's own checkbox does. | After next sync | d4b15962736 |
| INB-330 | Reading pane: selection and divider | A thread read that answers no rows at all (`rows: null`) still lets the reading column take its first row. | After next sync | d4b15962736 |

## 12. Reading pane: frame and question kinds

| Region | Rebuilt |
| --- | --- |
| Reading pane: frame and question kinds | no |

View files: `features/inbox/ReadingPane.tsx`.
Pinned by name: `handOffFocus` in `features/inbox/AskCard.tsx`, `PaneFrame` in `features/inbox/PaneDocument.tsx`.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-138 | Reading pane: frame and question kinds | The pane is a region named "Selected question" ("Selected thread" for a thread row), with id `inbox-pane`. It has a head on top and one scroller below it. | | |
| INB-139 | Reading pane: frame and question kinds | The scroller is a Tab stop named "Question body", with a focus ring. The arrow keys, Page Up/Down, Space, Home and End scroll it. | | |
| INB-140 | Reading pane: frame and question kinds | The scroller is one element for every row. A selection change scrolls it and never rebuilds it. | | |
| INB-141 | Reading pane: frame and question kinds | The pane opens a document only after the selection stays still for 200 ms. Two questions in one document do not reopen it, so holding `j` opens one document, not one per row. | | |
| INB-142 | Reading pane: frame and question kinds | While a snooze of the selected row (or a bulk snooze) is out, the place the row held is frozen, so the next selection comes from where the reader saw it. | | |
| INB-143 | Reading pane: frame and question kinds | A thread row is never kept in the pane after its row leaves the list. | | |
| INB-144 | Reading pane: frame and question kinds | A decision-block question shows the live document, read-only, with no presence and no edits. The block draws its own answer card. | | |
| INB-145 | Reading pane: frame and question kinds | The document opens with the block's section heading at the top: the nearest heading of any level before the block. A block before every heading opens at the top. | inside | the first draw of a question's document puts the column at the start of its section |
| INB-146 | Reading pane: frame and question kinds | A 2 px bar at the left edge marks the section, from its heading to the end of the block. With no heading there is no bar. | inside | a decision block's column marks the section from its heading down to the block |
| INB-147 | Reading pane: frame and question kinds | The placement is written again on each drawing pass. Both of its clocks start at the first drawing pass, so a hold that nothing has drawn in writes on. It is let go when drawing has been quiet for 200 ms with no diagram waiting, 3 s after the first pass, when the reader presses, scrolls, touches or types in the column, when the column closes, or by the head's "Skip to the answer". A press outside the column does not let it go. Opening another question starts a placement of its own. | inside | a column nobody has touched is written while it draws, and is let go at the bound |
| INB-148 | Reading pane: frame and question kinds | A section heading that is not drawn yet is not scrolled to. A document that is lost and read again is not placed again. | inside | a question's document lost and read again leaves the column where the reader left it |
| INB-149 | Reading pane: frame and question kinds | "Skip to the answer" shows in the head once the document shows. It scrolls the block to the top and ends the hold. Its retries stop after 3 s or when the row changes. | | |
| INB-150 | Reading pane: frame and question kinds | The pane falls back to the question's card, with Open page still in the head, for a document it cannot read, a text read that is refused (for example 409 DOC_SCHEMA), or an editor that reports itself unavailable. It never offers a repair and opens no room. | | |
| INB-151 | Reading pane: frame and question kinds | While the document opens, a skeleton reads "Opening \<approval name, document name or 'the document'>". | | |
| INB-152 | Reading pane: frame and question kinds | An approval request shows its question (Markdown, with a rule under it), then the latest version, read-only. Words changed since the last approval are marked. | | |
| INB-153 | Reading pane: frame and question kinds | A baseline sent without a server tree is still marked. A first request, with no earlier approval, marks nothing. | inside | an approval marks the version against a baseline answered with no reading |
| INB-154 | Reading pane: frame and question kinds | "Next change" shows only when marked blocks are drawn. Each press scrolls the next marked block to the top and wraps at the end. A new request starts at its first mark. | | |
| INB-155 | Reading pane: frame and question kinds | Question blocks in the version draw as a stored version draws them: the urgency pill and no composer. | inside | an approval draws the ask card of a question block in the version it shows |
| INB-156 | Reading pane: frame and question kinds | When the version text lands, the pane goes to its top, once per request, and again when the reader comes back to the request. If the reader scrolls, presses, touches or types first, their place wins. | | |
| INB-157 | Reading pane: frame and question kinds | A newer version of the document under approval redraws without moving the reader. | inside | a later version of the document under approval leaves the column where the reader is |
| INB-158 | Reading pane: frame and question kinds | A document that cannot be read, or that has no version, falls back to the card, and the question is drawn once. A failed version read shows "Could not load this document version." under the question. Neither scrolls. | | |
| INB-159 | Reading pane: frame and question kinds | While the version opens, the question shows at once, with "Opening <document name>" under it. | | |
| INB-160 | Reading pane: frame and question kinds | An anchored question, or a question in no document, shows the full ask card. No document opens. | | |
| INB-161 | Reading pane: frame and question kinds | The card and the head are keyed by ask, so no write of the previous question (a snooze still saving, a refusal) shows on the next one. | | |

## 13. Reading pane heads and row controls

| Region | Rebuilt |
| --- | --- |
| Reading pane heads and row controls | no |

View files: `features/inbox/ReadingPaneHead.tsx`, `features/inbox/SnoozeControl.tsx`, `features/inbox/AssignToMe.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-162 | Reading pane heads and row controls | The question head names the owner: the issue key (bold) and title, linked to the ask on its issue; for a document question "PROJECT · Document name", linked to the document; with neither, "Document ask" in muted text. | | |
| INB-163 | Reading pane heads and row controls | "Open page" (and `o`) of a question in a project document opens the document at the open section (`#b-<heading>`), else at the question's block, else at its anchor block, else with no fragment. With neither an issue nor a document, "Open page" is hidden. | | |
| INB-164 | Reading pane heads and row controls | "Open page" (and `o`) of a question of an issue opens the question's own document. A decision block in the spec or another issue document opens it at the section heading, or at the block when there is no heading, the editor has drawn nothing, or the pane cannot read it. An approval request opens its document with no fragment. A question on quoted text opens the quoted document at the quote's block. A row that names no document opens the issue page. A decision block's Reply thread opens its document at the section heading, else at the block, and at the block once the document is read and before the editor draws; it opens the thread's own page when the document cannot be read, or while the document or the ask is still being read. In a project document, a Reply thread, and a comment thread anchored there, open the thread's own page at its section heading. The Reply threads of an approval request, of a question on quoted text and of a question in no document open the thread's own page. | | |
| INB-165 | Reading pane heads and row controls | The priority control shows on issue questions only. | | |
| INB-166 | Reading pane heads and row controls | "Assign to me" shows in the head while nobody holds the issue, and stays while its write is out or refused. | | |
| INB-167 | Reading pane heads and row controls | The head's Snooze keeps the row and the pane on it while its write is out or refused (`onSnoozeLive`). | | |
| INB-168 | Reading pane heads and row controls | Copy reference shows in the head when the ask has a reference. | | |
| INB-169 | Reading pane heads and row controls | A hand-on from the card in the pane registers through a context, so the list keeps the row while the write is out or refused. | | |
| INB-170 | Reading pane heads and row controls | The thread head shows the owner link, or the session name for an Agent row. "Open page" uses the server's `ref` (plus `#b-<section>` when a document shows). Copy reference shows except on Agent rows. Dismiss shows ("Move to Inbox" in the Dismissed view). There is no priority, assign or snooze. | | |
| INB-171 | Reading pane heads and row controls | The Snooze control is a "Snooze" badge over a native select named "Snooze <label>". Its choices are "Later today" (+3 h, capped at the end of today; the next day 9:00 when less than 5 s remain), "Tomorrow" (9:00), "Next week" (next Monday 9:00) and "Until I clear it". The time is computed at the pick. It is drawn on card rows and in the pane head, not by the ask card. | | |
| INB-172 | Reading pane heads and row controls | A snooze moves the row into Later at once and reads "Snoozing…"; the row is held while the write is live. A refusal rolls back and shows the server's reason, else "Could not snooze <label>.", with Retry. A stopped write says "Dispatch has not confirmed the snooze: it may have been saved." with the PUT retry note. Retry snoozes the ask that its press was of, whichever ask the control draws by then. | changed | R14: a refused snooze shows a one-line toast with Retry, an unconfirmed one shows "It may have been made" with Try again, and a snooze that succeeds shows a toast with Undo. |
| INB-173 | Reading pane heads and row controls | A snoozed row shows "Back <time>" or "Snoozed until you clear it", and "Un-snooze <label>" ("Un-snoozing…"). The un-snooze is optimistic, with the same refusal and stopped words naming the un-snooze. | changed | R14: a refused un-snooze shows a one-line toast with Retry, an unconfirmed one shows "It may have been made" with Try again, and an un-snooze that succeeds shows a toast with Undo. |
| INB-174 | Reading pane heads and row controls | A snooze counts only while its time is ahead. Nothing an agent does shortens it. | | |
| INB-175 | Reading pane heads and row controls | "Assign to me" (named "Assign <KEY> to me") on an unassigned issue's row writes the reader's lowercase login and reads "Assigning…". It is optimistic. A refusal rolls back and shows the reason, else "Could not assign <KEY> to you.", with Retry. | changed | R14: a refused Assign to me shows a one-line toast with Retry, and an unconfirmed one shows "It may have been made" with Try again. |
| INB-176 | Reading pane heads and row controls | Dismiss (named "Dismiss: <line>") shows on thread rows only and reads "Dismissing…"; in the Dismissed view it is "Move to Inbox" ("Moving…"). It is optimistic. A refusal puts the row back where it was and says so; a stopped write says it may have been made. Outside an Inbox no Dismiss is drawn. | changed | R14: a refused or unconfirmed row dismiss reports in its toast, not in upstream's line above the list (`dismissWrite`). A row write reports in one place, and that line shows only a bulk dismiss's failure. |
| INB-314 | Reading pane heads and row controls | Below 1280 px, Escape on the view head's Snooze or Priority goes back to the list, at the row. | After next sync | d4b15962736 |
| INB-324 | Reading pane heads and row controls | Below 1280 px, a dismiss refused from the reading view's head is said where the reader is. **Changed when the sync brings it:** R14: a refused row write shows a toast with Retry. | After next sync | d4b15962736 |
| INB-349 | Reading pane heads and row controls | An approved document shows the approval that it follows in place of the actions, and its version. | | |
| INB-350 | Reading pane heads and row controls | A priority pick stays drawn from the press until its save lands, over the reads that land meanwhile, and of two picks the last one wins. | | |
| INB-351 | Reading pane heads and row controls | A refused snooze's note wraps beside its control and never widens the page. | | |

## 14. Threads: bodies, reply boxes, cards and read marks

| Region | Rebuilt |
| --- | --- |
| Threads: bodies, reply boxes, cards and read marks | no |

View files: `features/inbox/ThreadBody.tsx`, `features/inbox/ThreadPane.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-177 | Threads: bodies, reply boxes, cards and read marks | A comment thread on an issue, or an issue message conversation, shows a bold subject line, then the whole thread and its reply box. No document opens. | | |
| INB-178 | Threads: bodies, reply boxes, cards and read marks | A comment thread in a document, with an anchor the pane can place, shows the live document at the block's section. The thread draws under its block, and the quote is highlighted. | | |
| INB-179 | Threads: bodies, reply boxes, cards and read marks | The thread shows alone, with its quote, for an orphaned anchor, an anchor with no block id, a document comment with no anchor, a document that cannot be read, or a block the drawn document does not hold. | | |
| INB-180 | Threads: bodies, reply boxes, cards and read marks | An ask's thread shows the ask's own full card. For a decision-block ask the pane opens its document at the block. | | |
| INB-181 | Threads: bodies, reply boxes, cards and read marks | An Agent row shows the session's name, the whole thread and a reply box. | | |
| INB-182 | Threads: bodies, reply boxes, cards and read marks | Each message shows "author · time", a Markdown body, and a "New" pill when unread. Unread means written after the row's read mark; for an Agent row it means one of the row's unread reply ids. | | |
| INB-183 | Threads: bodies, reply boxes, cards and read marks | The root and the two newest replies show. Older read replies fold behind "Show N earlier replies" / "Show fewer replies". An unread reply never folds. | | |
| INB-184 | Threads: bodies, reply boxes, cards and read marks | Thread order places the fold and the box. Oldest first (the default): the fold under the root, replies oldest first, then the box. Newest first: the box under the root, replies newest first, then the fold. | | |
| INB-185 | Threads: bodies, reply boxes, cards and read marks | Under Oldest first, the pane's own thread body and its fallback open scrolled to the first unread message. A thread drawn in a document, and a card, do not. | | |
| INB-186 | Threads: bodies, reply boxes, cards and read marks | A comment thread holds every comment whose reply chain reaches the root, sorted by time and then by id. | | |
| INB-187 | Threads: bodies, reply boxes, cards and read marks | A thread body shows "Opening the thread" while it loads and "Could not load this thread." on failure; an Agent row shows "Opening the conversation" and "Could not load this conversation.". There is no Retry. | | |
| INB-188 | Threads: bodies, reply boxes, cards and read marks | A message row with no issue draws an empty body. A document comment with no anchor shows a skeleton while its document is found by project and slug, then nothing if it is not found. | | |
| INB-189 | Threads: bodies, reply boxes, cards and read marks | The quote above a thread (in the card and in the fallback) has a left bar and muted text. An empty quote and an Agent row show none. | changed | R12 (rule SU2): the quote takes a background step, not a left bar. |
| INB-190 | Threads: bodies, reply boxes, cards and read marks | The comment box is a standing "Reply" box that replies to the root comment. It shows only when the root is in the read, and has no Cancel reply and no Close. After a send the thread and the list are read again. A closed issue still takes comments; only Suggest and Ask are hidden. A refusal reads "Couldn't send — <server words>"; a stopped send gets the POST retry note. | | |
| INB-191 | Threads: bodies, reply boxes, cards and read marks | The message box replies to the root message. When the thread has a target, the reply carries it with the newest attempt's delivery mode (default steer). | | |
| INB-192 | Threads: bodies, reply boxes, cards and read marks | A file pasted into a box uploads to the thread's owner. A refused upload shows an alert with Retry. The next thread's box shows none of it. | | |
| INB-193 | Threads: bodies, reply boxes, cards and read marks | The Agent box (field "Comment", button "Send") shows only while the session is in the live list and the thread has a newest message. It replies under that message, with no Cancel reply and no issue picker. If a newer message arrives over a refused reply, the box says "This message was written as a reply to an earlier message, and this box now replies to a newer one. Discard it to write a reply here." and offers Discard draft, not Retry. | | |
| INB-194 | Threads: bodies, reply boxes, cards and read marks | A session the live list no longer holds shows "Not in the live session list — it may have ended." and no box. The thread stays readable. | | |
| INB-195 | Threads: bodies, reply boxes, cards and read marks | A listed session with no delivery mode shows "Takes no messages" and a warning that a message sent here records a failed attempt, with the reason (no capabilities, or none of them is a known delivery mode). The box still shows. | | |
| INB-196 | Threads: bodies, reply boxes, cards and read marks | A reply the session took as a turn shows "Taken as a turn of the live conversation." and a "Live view" link to `/agents/<id>/live`. | | |
| INB-197 | Threads: bodies, reply boxes, cards and read marks | Each box belongs to its thread, and each ask card to its ask. No refusal, upload or pending send shows on another thread or ask, and Retry acts on its own. | | |
| INB-198 | Threads: bodies, reply boxes, cards and read marks | A Reply row is marked read through its newest reply once its newest message has stood at least 75 % in view for 1 s; a message taller than the box it is read in counts once it fills 75 % of that box. Only threads in the owner's unread set are watched, or every thread when that set holds over 200 rows. The row stays listed, drawn as read. It is silent and not optimistic. | | |
| INB-199 | Threads: bodies, reply boxes, cards and read marks | For an ask thread the read check watches the whole card. With no issue and no document id, nothing is marked. | | |
| INB-200 | Threads: bodies, reply boxes, cards and read marks | An Agent row is read by reply id and never moves the session's read mark. A reply that arrives while the thread shows must dwell again. | | |
| INB-201 | Threads: bodies, reply boxes, cards and read marks | A thread card (below 1280 px) shows the kind icon, the title and the time of the last write; then the priority tag and owner line; then the thread and its quote; then "Open", "Mark read" and Dismiss. In the card the title is plain text, not a link. **From `d4b15962736`:** see INB-302. | changed | R2: no thread card at any width. A thread's row is the two-line row, and it opens in the pane or the peek. |
| INB-202 | Threads: bodies, reply boxes, cards and read marks | "Mark read" on a thread card marks the thread through its newest reply (an Agent row: its unread ids) and reads "Marking read…". It is not optimistic. A refusal shows the error with Retry. A stopped mark says it may have been saved, and Retry marks what the stopped press marked. | changed | R14: a refused Mark read shows a one-line toast with Retry, and an unconfirmed one shows "It may have been made" with Try again. The fork's mark read is `inline: true`, which upstream's write is not. |
| INB-203 | Threads: bodies, reply boxes, cards and read marks | An edited message or ask-thread reply shows "edited" on its byline; a deleted one reads as deleted and gives no part of its body. | | |
| INB-204 | Threads: bodies, reply boxes, cards and read marks | A thread's subject line in the pane reads as deleted for a deleted root and marks an edited one. | | |
| INB-205 | Threads: bodies, reply boxes, cards and read marks | A comment or message thread whose root was deleted draws no reply box. A reply the reader typed for it stays on screen, with Discard my draft. | | |
| INB-326 | Threads: bodies, reply boxes, cards and read marks | The open row keeps a thread's chosen order over a reload. | After next sync | d4b15962736 |
| INB-352 | Threads: bodies, reply boxes, cards and read marks | A reply sent from the pane reaches the thread, and a reply to an Agent row is sent in the mode that the Agents page uses. | | |
| INB-353 | Threads: bodies, reply boxes, cards and read marks | A long reply shows whole. | | |
| INB-354 | Threads: bodies, reply boxes, cards and read marks | A reply sent from the Dismissed view leaves the thread in the Dismissed view. | | |
| INB-355 | Threads: bodies, reply boxes, cards and read marks | A Reply thread's subject draws stored references as their targets' names. | | |

## 15. Ask card

| Region | Rebuilt |
| --- | --- |
| Ask card | no |

View files: `features/inbox/AskCard.tsx`, `features/inbox/AskOptionList.tsx`, `features/inbox/AskOptionRow.tsx`, `features/inbox/AskCompletionCard.tsx`, `features/inbox/AskAnchorLink.tsx`, `features/inbox/AskApprovalLink.tsx`, `features/inbox/AskBlockLink.tsx`, `features/inbox/AskHandOn.tsx`, `features/inbox/AskRecipients.tsx`, `features/inbox/AskThread.tsx`, `features/inbox/AskThreadDisclosure.tsx`, `features/inbox/UnsentText.tsx`, `features/inbox/DeclineControl.tsx`, `features/inbox/EarlierApproval.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-206 | Ask card | An open ask is a card. Screen readers hear its urgency ("Urgency: Low", "Medium", "High" or "Blocking"). An unknown urgency word reads as Medium. | | |
| INB-207 | Ask card | Blocking and High asks show their urgency word on the card's top edge. Low and Medium show none, and a card inside a decision block shows none. | | |
| INB-208 | Ask card | An anchored ask shows its document's name as a link, then the quoted passage. The link goes to `/issues/<KEY>/spec#b-<block>`, `/issues/<KEY>/artifacts/<slug>#b-<block>` or `/projects/<P>/documents/<slug>#b-<block>`; with no block id there is no fragment. The quote stays when the document is gone. | | |
| INB-209 | Ask card | An orphaned anchor shows "Text changed." and "View original text", linked to the document at the anchor's version with `?ask=<id>`. | | |
| INB-210 | Ask card | A decision-block ask shows "Open in document", linked to its document at `#b-<block>`. | | |
| INB-211 | Ask card | An approval ask shows "Approval requested" and links "<document name>, version N" to the document with `?ask=<id>`. | | |
| INB-212 | Ask card | The question renders as Markdown; a `#id` in it resolves against the ask's scope. Inside a decision block the card does not draw the question. | | |
| INB-213 | Ask card | A repeated approval request shows "Approved at version N on <date> by <who>." and "Show diff" / "Hide diff". The diff reads both versions only when opened, cuts out the decision blocks, and says "Loading versions to compare…" or "Could not load versions to compare.". | | |
| INB-214 | Ask card | The turn label reads "Waiting on you" or "Waiting on <agent>" (the newest reply's session, else the asker). A closed ask has none. | | |
| INB-215 | Ask card | The provenance line shows the asker, "·" and the time ("asked" when the author is unknown). A session asker is a button that opens copy buttons for its id, title and tmux target, with a "↗" link to `/agents/<id>/live`. | | |
| INB-216 | Ask card | Copy reference copies the ask's reference in Dispatch's reference scheme: `<KEY>/ask/<id>` under its issue, or `<P>/artifact/<slug>/ask/<id>` under its document; a card with no known owner has none. | | |
| INB-217 | Ask card | "Referenced by (N)" opens the backlinks list. It hides at 0 and stays after an answer. | | |
| INB-218 | Ask card | An edited question shows "Edited <time>" and "Show N previous version(s)", each with its options and "Reworded by <who> · <time>". | | |
| INB-219 | Ask card | An open ask shows "Asked of <login>" or "Asked of nobody" over a select "Hand this question to": a disabled Nobody, the issue's assignee (Inbox rows only), then everyone who has signed in. The people list loads only when the reader reaches for it. Once handed on, "handed on by <who> <time>" shows. | | |
| INB-220 | Ask card | Picking a person hands the ask on ("Handing on…"), optimistically on every Inbox read. A refusal rolls back and shows the reason, else "Could not hand this question on.", with Retry. A stopped write says it may have been made, with the PUT note. | changed | R14: a refused hand-on shows a one-line toast with Retry, and an unconfirmed one shows "It may have been made" with Try again. |
| INB-221 | Ask card | Options are radio rows (one choice) or checkbox rows (several), each with its label and description. An "Other" row follows, except on approvals. | | |
| INB-222 | Ask card | The answer box's label and placeholder follow the choice: "Answer in your own words, or ask a question back", "Add a note (optional)", "Note (optional)" for Approve, or a visible "Reason (required)" with "Why?" for Request changes. | | |
| INB-223 | Ask card | Answer is disabled until the answer can be sent. Picking Request changes focuses the box and says "Add a reason to send Request changes". | | |
| INB-224 | Ask card | Answer sends the picks, the trimmed text and the question version the reader saw, and reads "Answering…". The row leaves the Inbox at once. Each of seven codes has its own refusal words and no Retry: ASK_ANSWER_CHANGED, NOT_ANSWERER, ASK_APPROVAL_REVIEW, ASK_CLOSED, ASK_RESOLVED, ASK_EDITED and CAP_EXCEEDED. Any other failure says "Could not save your answer." with Retry. A stopped answer (`SendStoppedError`) says it may have been saved, with Retry. | | |
| INB-225 | Ask card | A second press while an answer is out does nothing. If a stopped answer's question then closes, the card says "The question has closed, and the record above shows how." with no Retry. | | |
| INB-226 | Ask card | Ctrl+Enter or Cmd+Enter in the answer box submits; Enter adds a line. Nothing fires during IME composition, while an upload is out, or while the card refuses. | | |
| INB-227 | Ask card | Question-shaped text with no option picked does not send on Answer. The card offers "Ask back instead" (focused) and "Answer with it anyway"; typing again removes the offer. | | |
| INB-228 | Ask card | "Ask back" posts the text as a question on the ask ("Sending…"). The ask stays open, the box clears and the picks stay. A refusal says "Could not send your clarification." with Retry; a stopped one says it may have been sent. | | |
| INB-229 | Ask card | A file pasted or dropped into the answer box uploads to the ask's issue, else to the document's project. Answer and Ask back wait for the upload. | | |
| INB-230 | Ask card | The compact card (in a decision block) folds the box behind "Add a note or answer in your own words". It opens itself for Other, Request changes or a change. A press opens it and focuses the box. | | |
| INB-231 | Ask card | When the form leaves, or a focused button becomes disabled, the focus moves to the row. It never drops to the page body. | changed | R5: after an answer, a snooze, a dismiss or an Assign to me under Unassigned of the row open in the peek, the focus goes to the peek's next row in the list, or to the list's empty state when no row is left. It never goes to the page body. |
| INB-232 | Ask card | If the question changed while the reader answered (ASK_EDITED), the picks clear, the thread reloads, and a warning says so; the text stays. | | |
| INB-233 | Ask card | The person who gave a non-approval answer sees "Change answer". It reopens the form with "Save answer" and "Cancel". Cancel leaves the answer and no draft. A stale or refused change closes the form and shows the current record with its own words. | | |
| INB-234 | Ask card | "Decline to answer" sits under an open question (not an approval). Its dialog has a "Note (optional)" box with a characters-left count, Cancel, and "Decline to answer" ("Declining…"). Escape, the backdrop and Cancel close it, but not while the decline is out. Ctrl/Cmd+Enter sends. | | |
| INB-235 | Ask card | A decline takes the row out at once. A refusal brings it back and shows the server's words, else "Could not decline this question. Try again.". A stopped decline says pressing again sends a new decline. | | |
| INB-236 | Ask card | An answered ask shows its record: every option with ✓ on the chosen ones, the Other text, and "Asked <t> · Answered by <who> <t>". A changed answer shows "Changed <t>" and "Show N earlier answer(s)". | changed | R12: upstream's record carries a border colour class with no width (`calloutSuccessBorder`), so it draws no border. A port that adds the width would draw a border in an upstream palette colour, which the theme rule refuses. |
| INB-237 | Ask card | A declined, withdrawn, retracted or resolved ask shows its question, a status word such as "Declined", the options with none chosen, and "Asked <t> · <resolution> - <reason>". | changed | R12: upstream's record carries a border colour class with no width (`card`), so it draws no border. A port that adds the width would draw a border in an upstream palette colour, which the theme rule refuses. |
| INB-238 | Ask card | When a read shows the ask closed elsewhere, the card becomes the record in place. Text the reader had not sent shows read-only: "This question closed before you sent your answer, so it was not sent. Your text is here to copy." | | |
| INB-239 | Ask card | "Reaches N" (folded) lists who the open ask reaches: followers, then via claim, via route, via subscription; a route nobody holds shows "Nobody holds it right now", and an unknown listener "Route reach unknown". It shows on the open form only. | | |
| INB-240 | Ask card | "Unfollow" and "Unsubscribe" each ask for confirmation, name what still reaches the session, and say "They will be told.". A 404 counts as done. Refusals say "Could not unfollow." or "Could not unsubscribe." with Retry. A wider-topic subscriber shows "via <topic>" and no button. | | |
| INB-241 | Ask card | Subscribers are read for a signed-in person only and stay fresh for 30 s. A failed read shows "Subscribers unavailable — Envoy listener unreachable." with Retry. | | |
| INB-242 | Ask card | The inline thread shows the newest two replies; older ones fold behind "Show N earlier replies". An unread reply never folds, and a linked reply opens the fold. The reader's thread order places the answer and reply boxes. | | |
| INB-243 | Ask card | A reply box ("Reply", "Replying…") shows once the ask is not open. All composers of one ask share one send. A refusal says "Could not post your reply." with Retry. A collapsed thread offers "Write a reply", and on a failed read "Replies unavailable — retry". | | |
| INB-244 | Ask card | A failed inline thread read shows nothing: no error and no retry. | changed | R10 of the app's design, which the page's design builds on (a read is loading, an error with a retry, or ready): upstream shows nothing, so the reader cannot tell a failed read from an empty thread, and cannot read it again. The fork shows the error state with its retry. |
| INB-245 | Ask card | Each ask has one thread read, seeded from the Inbox answer with no extra fetch. A read that started before the seed cannot overwrite it. Any `ask.*` event or comment naming the ask reads it again. | | |
| INB-246 | Ask card | While an answer, decline, hand-on or snooze is out, a new Inbox read waits until Dispatch has taken it, so the row never flickers back. | | |
| INB-298 | Ask card | The line of each write on an ask in the pending-writes indicator (an answer, a question back, a reply, a decline) holds the question's plain-text reading, never its Markdown. | | |
| INB-299 | Ask card | An earlier answer draws each option that it chose from the server's reading of the option's label, an option that the ask no longer holds included. | | |
| INB-300 | Ask card | A decline note past the bound of an event body shows a negative count ("-5 characters left"), and neither "Decline to answer" nor Ctrl+Enter or Cmd+Enter sends it. | | |
| INB-356 | Ask card | A backlink list that cannot be read shows "Referenced by unavailable." beside the ask card, with Retry and no alert. | | |
| INB-357 | Ask card | Ctrl+Enter or Cmd+Enter sends an ask's reply, but not while an upload into it is out. | | |
| INB-358 | Ask card | Stored references in an ask's replies and on the ask's other surfaces draw as their targets' names. | | |
| INB-359 | Ask card | A reply that holds only a reference shows that reference's card. | | |
| INB-360 | Ask card | A reply that the reader stopped says that Retry asks again under its key. | | |
| INB-361 | Ask card | Who the ask reaches names each follower by its registry title, else by its shortened id, with the registry's running state and a live link. | | |
| INB-362 | Ask card | While the agents list refills, who the ask reaches says so, and claims no count and no offline follower. | | |
| INB-363 | Ask card | For an ask that a project document owns, who the ask reaches reads that document's subscribers. | | |
| INB-364 | Ask card | Who the ask reaches lists each session once, in one order: a session that is a route and the claimant is listed once, via its claim, and a subscribed claimant or route session once, as a subscriber that keeps Unsubscribe. | | |
| INB-365 | Ask card | "Reaches N" counts each recipient once, and counts a session route's session whose reach is unknown without calling it offline. | | |
| INB-366 | Ask card | An unfollow that the reader stopped says that it may have been made, and its Retry unfollows on the ask it was pressed on, also after the card moves to another ask. | | |
| INB-367 | Ask card | An Inbox reply's `#q2` names the question of the document that its comment is anchored to. | | |
| INB-368 | Ask card | An option's label draws as inline Markdown. | | |
| INB-369 | Ask card | On a phone, an ask card's time stays beside its author. | | |

## 16. Live updates and held rows

| Region | Rebuilt |
| --- | --- |
| Live updates and held rows | no |

View files: none.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-247 | Live updates and held rows | The list is one inbox read shared with the sidebar badge, the Agents page and the margin, so an answered row leaves every surface at once. | | |
| INB-248 | Live updates and held rows | Ask events (opened, edited, handed back, asked of, answered, resolved, follower changes), comments on an ask, approvals, change requests and block repairs read the inbox again. | | |
| INB-249 | Live updates and held rows | The thread rows, the unread count and the unread sets are read again on each comment and message created, answered, edited or deleted; on each ask opened, answered, asked of someone or resolved; on a change of the project's default assignee; on an issue closed; and on an issue update that moves its status or assignee, or does not say what it moved. When a write names the people of its thread (`thread_logins`), the read happens only when the reader is one of them or wrote it. | | |
| INB-250 | Live updates and held rows | A cold Inbox fills every ask's thread from the one list answer; an unchanged cached Inbox does not refetch every thread on remount. | | |
| INB-251 | Live updates and held rows | A refetch that lands while the pointer moves over the list is held until the pointer rests 400 ms, leaves the list, or presses; moving onto a hover card the list opened keeps the hold. | | |
| INB-252 | Live updates and held rows | When rows above the reader's row change, the list keeps that row where it was on screen (scroll compensation in the list, the drawer or the window). | | |
| INB-253 | Live updates and held rows | The row under the reader's hand (focus or pointer) that the server drops, or moves to another band, stays where they saw it until the hand leaves; a move into or out of Later shows at once. | changed | R5: the peek and the drawer's item view also keep their row while the reader's answer is out. The peek sits over the list, so the focus leaves the row, and upstream's hand would let the row go. |
| INB-254 | Live updates and held rows | The reader's own Ask back keeps the row under Waiting on you, unscrolled, until they leave it; an agent's note that flips the turn keeps the row and its draft until they leave it. | | |
| INB-255 | Live updates and held rows | The reader's own answer and their own dismiss leave the list at once, even with the focus and pointer on the row. | | |
| INB-256 | Live updates and held rows | After the reader's own answer fails, an answer from elsewhere still holds the row they are in. | | |
| INB-257 | Live updates and held rows | A priority pick that takes the row under the hand out of the priority filter draws the pick from the press to the landing; an unsent answer keeps the question in the pane. | | |
| INB-258 | Live updates and held rows | A row whose Assign to me or hand-on write is live stays listed whatever the filters say, so "Assigning…", "Handing on…", a refusal and its Retry stay on screen. Only an ask the list was drawing is held. **From `d4b15962736`:** A live Assign to me keeps its row listed only in the drawer's card; below 1280 px, Assign to me under Unassigned moves the reading view to the next row at the press (INB-318). | | |
| INB-259 | Live updates and held rows | A sibling ask of the same issue leaving the list does not drop an in-flight Assign to me; its refusal still shows. | | |
| INB-260 | Live updates and held rows | Thread rows come from one unpaged read in the Inbox view, and from pages behind "Show more" in the Dismissed view. A list filtered to ask types only, and a principal that is not a person, read no thread rows. | | |
| INB-261 | Live updates and held rows | If an ask event arrives while the Inbox is loading, that ask's card reads its own endpoint until a newer list lands. Claim, release and route events do the same for the issue's asks. | | |
| INB-262 | Live updates and held rows | After an answer, an Ask back or a hand-on, the Inbox, the issue's asks, the issue and the issues list are read again (for a document ask: the document and the projects). | | |
| INB-263 | Live updates and held rows | An edit or a delete of a thread's post reaches the thread rows from the live feed, even when the refetch fails: the row reads as edited, then deleted. | | |
| INB-370 | Live updates and held rows | Reads of the Inbox asked while a dismiss is out wait for its answer. | | |
| INB-371 | Live updates and held rows | A thread started while a dismiss is out shows after its event. | | |
| INB-372 | Live updates and held rows | A reply by someone else brings a dismissed thread back to the Inbox, unread. | | |
| INB-373 | Live updates and held rows | A list of 120 threads sorted by priority keeps that order and follows a priority change live. | | |
| INB-374 | Live updates and held rows | A band header stays with the row that the pointer holds. | | |
| INB-375 | Live updates and held rows | A thread read that started before a write does not overwrite that write. | | |
| INB-376 | Live updates and held rows | An Inbox read held behind an ask write is let go by that write's event. | | |
| INB-377 | Live updates and held rows | A hand-on reads the ask's thread again, so a card that reads that thread follows the write. | | |

## 17. Drafts

| Region | Rebuilt |
| --- | --- |
| Drafts | no |

View files: none.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-264 | Drafts | The answer draft is kept per ask and shared by every card of that ask. It comes back after a redraw, after the reader moves to another ask and back, and after a reload. It is dropped when the server records the answer. A Change answer edit never writes it. | | |
| INB-265 | Drafts | The ask reply draft uses the same store under `reply`, shared by every reply box of the ask. It survives the ask resolving or opening again, and closing "Write a reply". It is dropped after a send (only if the draft still equals the sent text) or when the box is emptied. | | |
| INB-266 | Drafts | When an ask opens again, the reader's unsent reply shows read-only: "This question opened again before you sent your reply, so it was not sent. Your text is here to copy." | | |
| INB-267 | Drafts | Unsent text in a thread's reply box waits under that thread. When the reader moves to another row and back, the text comes back with its refused or stopped note. Other boxes stay empty. | | |
| INB-268 | Drafts | Escape in a reply box ends nothing: the draft and its note stay. | | |
| INB-269 | Drafts | A write that lands after the card moved to another ask changes only its own ask's form and draft. | | |
| INB-270 | Drafts | A draft survives a reload in the same tab, for the same person (`sessionStorage` key `dispatch.draft:<store>:<key>`, holding the login, the text and a format version). It is read back at that person's first sign-in. | | |
| INB-271 | Drafts | Another person's sign-in forgets every draft in the page and the tab; a lapsed session keeps them; a reload drops another person's entries. | | |
| INB-272 | Drafts | A sign-out forgets that person's drafts in the page and the tab, and the store takes no new draft until someone signs in. Other people's entries stay. | | |
| INB-273 | Drafts | Before the store knows who is signed in, drafts stay in the page only. On the first load, entries of stores the app no longer has are dropped. | | |
| INB-274 | Drafts | A draft over 65,536 characters, or one that would take its store over 262,144, is not kept in the tab but stays in the page. A waiting draft is kept as soon as there is room. | | |
| INB-275 | Drafts | A notice in the shell's status corner gives one line per reason, in this order: too long, store full, browser refused. It goes when every draft is kept. The three texts are upstream's, word for word. | | |
| INB-378 | Drafts | A reply box's refused or stopped note comes back after a reload. | | |

## 18. Inbox drawer

| Region | Rebuilt |
| --- | --- |
| Inbox drawer | no |

View files: `features/inbox/InboxDrawer.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-276 | Inbox drawer | The drawer is the Inbox as a modal panel at the right of any page but the Inbox, opened by `i` or the compact header's Peek; it is titled "Inbox" and has a Close button. | | |
| INB-277 | Inbox drawer | Opening moves the focus to Close; closing returns it to the opener; a click on the backdrop closes it. | | |
| INB-278 | Inbox drawer | The drawer takes the focus as it opens (the dialog element first, its field a frame later), so a key typed before its first frame reaches nothing behind it; its Escape works wherever the focus is. | | |
| INB-279 | Inbox drawer | A route change underneath closes the drawer; opening an item from inside it closes it too. | | |
| INB-280 | Inbox drawer | The drawer's filters, sort, grouping, show and search are its own state, never the address; a pick leaves the drawer open. | | |
| INB-281 | Inbox drawer | The drawer shares the page's browser-kept folds and thread order. | | |
| INB-282 | Inbox drawer | The drawer is always the card list (no reading pane, no `?item=`), even at 1440 px. | changed | R2: the drawer draws the two-line row and opens it in its item view, over its list. It still writes no `?item=`. |
| INB-283 | Inbox drawer | Snooze and answering inside the drawer work as on the page. | | |
| INB-284 | Inbox drawer | Escape with a row focused leaves the row first; a second Escape closes the drawer. | changed | R8: in the drawer, Escape first closes the item view, then blurs the row, then clears the selection, and then closes the drawer. |
| INB-285 | Inbox drawer | The drawer's rows scroll in the drawer, and the viewport anchor moves the drawer's scroll, not the window's. | | |
| INB-327 | Inbox drawer | The drawer keeps each row's card at every width, and only the drawer's rows show the "<agent> replied" chip. **Changed when the sync brings it:** R2: the drawer draws the one row and opens it in its item view. | After next sync | d4b15962736 |
| INB-379 | Inbox drawer | The drawer's keys act on the drawer's rows, never on the page behind it. | | |
| INB-380 | Inbox drawer | A message half-typed on the page under the drawer survives the drawer. | | |
| INB-381 | Inbox drawer | On a phone, the drawer opens from the compact top bar and covers the screen. | | |
| INB-384 | Inbox drawer | In the drawer an ask row is its whole card under a control line: mark box, kind icon, owner link, the "<agent> replied" chip, urgency, priority, Assign to me, Snooze. | changed | Split from INB-40. R2: in the drawer, an ask's row is the two-line row with no card, and it opens in the drawer's item view. |
| INB-385 | Inbox drawer | In the drawer a thread row is its mark box over the thread's card. | changed | Split from INB-41. R2: in the drawer, a thread's row is the two-line row with no card, and it opens in the drawer's item view. |
| INB-386 | Inbox drawer | In the drawer, Enter moves the focus into the answer box of the row in hand. It fires from a row or from nothing focused; a focused link or button keeps Enter. | changed | Split from INB-110. R4 and R8 (rule LR4): in the drawer, Enter on each row other than an open ask opens the row in the drawer's item view, and on an open ask it takes R4's steps, first opening the item view below 1280 px. |
| INB-387 | Inbox drawer | The drawer has no pane, no selection and no `?item=`. | changed | Split from INB-127. R2: in the drawer, the row opens in the drawer's item view, over the drawer's list, and the item view writes no address. |
| INB-388 | Inbox drawer | In the drawer a thread card shows the kind icon, the title and the time of the last write; then the priority tag and owner line; then the thread and its quote; then "Open", "Mark read" and Dismiss. In the card the title is plain text, not a link. | changed | Split from INB-201. R2: in the drawer, a thread's row is the two-line row with no card, and it opens in the drawer's item view. |
| INB-389 | Inbox drawer | In the drawer, when the form leaves or a focused button becomes disabled, the focus moves to the row. It never drops to the page body. | changed | Split from INB-231. R5: when the drawer's item view closes after an answer, a snooze, a dismiss or an Assign to me under Unassigned, the focus goes to the row that takes the done row's place, else the row before it, else the list's empty state. It never goes to the page body. |

## 19. Answered by you

| Region | Rebuilt |
| --- | --- |
| Answered by you | no |

View files: `features/answers/AnswersPage.tsx`.
Pinned by name: none.

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| INB-286 | Answered by you | The tab title is "Answered by you · Dispatch"; the page has a "← Inbox" link, the heading and the line "Every answer you gave and every reply you wrote on an ask, newest first." | changed | R2: Answered by you becomes the Inbox's second tab, in the view header. |
| INB-287 | Answered by you | Each row shows the time, the owner link, the question (two lines), the chosen options as pills and the answer text; a reply row shows "Replied:" and the reply. **From `d4b15962736`:** The chosen options are a capped group, and a long label wraps. | changed | R2: Answered by you has the Inbox's row and split view. |
| INB-288 | Answered by you | An answer that was later changed is marked "Changed since". | | |
| INB-289 | Answered by you | Each row has "Open" to the ask's own page. | | |
| INB-290 | Answered by you | "Change answer" shows only on a current, answered, non-approval answer; it opens the ask card seeded with the answer under the first answer row of that ask, and the card stays mounted across the refetch the change causes. | changed | R2 and R5: Change answer opens the ask's form in the reading pane, filled with the answer. |
| INB-291 | Answered by you | The Change card shows "Loading the ask" while it reads and "Could not load the ask: <message>" on failure. | | |
| INB-292 | Answered by you | The page loads 50 rows at a time; "Show more" appends the next page ("Loading…" while it reads). | | |
| INB-293 | Answered by you | Loading shows "Loading your answers"; failure shows "Could not load your answers: <message>"; an empty page says "You have not answered or replied on an ask yet." | | |
| INB-294 | Answered by you | A new answer or a reply on an ask reads the page again. | | |
| INB-295 | Answered by you | A reply row whose comment was deleted reads as deleted and gives no part of its body; an edited one shows "edited" on its "Replied" label. | | |
| INB-301 | Answered by you | A row's chosen options draw each label from the server's reading of it, not from a parse in the page. | | |
| INB-328 | Answered by you | A current answer that cannot be changed says why in place of Change answer. | After next sync | d4b15962736 |
| INB-382 | Answered by you | An Answers row's question, answer and reply draw stored references as their targets' names. | | |

## Keys

The key map below gives each key of the Inbox, with the rows that it serves, and the key conflicts give the choice that the fork takes where two key rules disagree.
These are not parity tables, so the parity script does not read them (README, "Checks").
Each command is one catalog command that holds all of its keys, and it is also a palette row with the row in hand as its subject.
One-key commands act on the marked rows, else on the row in hand.

| Key | Command | Where it works | Rows |
| --- | --- | --- | --- |
| `g i` | Go to the Inbox | everywhere | INB-1, INB-94, INB-125, INB-286 |
| `g y` | Go to Answered by you | everywhere | INB-4, INB-22 |
| `i` | Open or close the inbox drawer | every page but the Inbox | INB-27, INB-125, INB-276 |
| `$mod+k` | Open the palette; the row in hand is its subject | everywhere | INB-126 |
| `?` | Open the shortcut sheet | everywhere | INB-126 |
| `/` | Move the focus to the list's search box; on a page with no search box, open the palette | everywhere | INB-67, INB-123; KC1 |
| `f` | Open the Filter picker | the list | INB-74, INB-79, INB-123; KC1 |
| `$mod+f` | None: it stays the browser's find | everywhere | KC1 |
| `j` and `↓`, `k` and `↑` | Next row, previous row (one command each) | the list; the arrows only while the focus is in the list | INB-47, INB-107–INB-109, INB-129, INB-134 |
| `t` | Fold or open the group of the row in hand | the list | INB-60 |
| `Shift+→` | Show the next rows of the group in hand (in Dismissed, the next 200) | the list, Answered by you | INB-64, INB-65, INB-292; KC13 |
| `x` | Mark or unmark the row in hand | the list | INB-97, INB-114 |
| `Shift+↓`, `Shift+↑` | Extend the marks | the list | INB-97 |
| `$mod+a` | Mark every row that the view matches | the list | INB-102 |
| `Enter` | On an open ask: move the focus to the first option (to the answer box when it has none), pick an option, or send. On each other row: open it in the pane from 1280 px, in the peek below, and in the item view in the drawer. Below 1280 px, an open ask first opens over the list | a row, the options | INB-110, INB-149, INB-230; KC3 |
| `Space` | Open or close the peek; in the drawer, open or close the item view; from 1280 px, nothing | a row | INB-127 |
| `Escape` | By the focus: in the Filter picker, close it; in the search box, clear the text, then leave the box; in the pane, go back to the row; in the peek, close it and go back to its row; on a row, close the peek if it is open, then blur the row, then clear the marks | the list, the pane, the peek | INB-105, INB-118, INB-120, INB-122, INB-124; KC2 |
| `Escape` in the drawer | Close the item view, then blur the row, then clear the marks, then close the drawer | the drawer | INB-284 |
| `l` | Move the focus into the reading pane | the list, with the pane on | INB-117; KC12 |
| `1`–`9` | Pick option 1–9 of the row's ask | a row, the pane | INB-111, INB-221 |
| `0` | Pick Other | a row, the pane | INB-221 |
| `$mod+Enter` | Send the answer, the reply or the message | in a box, and in an ask's body | INB-190, INB-191, INB-193, INB-224, INB-226, INB-243 |
| `$mod+Shift+Enter` | Send the text as a question back | in the answer box | INB-227, INB-228 |
| `o` | Open the row's issue, document or thread; no key sequence starts with `o` | a row, the pane, the drawer | INB-49, INB-53, INB-112, INB-162–INB-164, INB-279; KC4 |
| `y`, `$mod+Shift+,` | Copy the reference | a row, the pane | INB-50, INB-113, INB-168, INB-216; KC10 |
| `Shift+Y`, `$mod+.` | Copy the issue key | a row, the pane | KC10 |
| `h` | Snooze; with marks, the bulk Snooze picker | a row, the pane | INB-100, INB-116, INB-167, INB-171 |
| `Shift+H` | Un-snooze | a snoozed row | INB-173 |
| `e`, `Backspace` | Dismiss a thread; in Dismissed, Move to Inbox | a thread row, marked rows | INB-51, INB-103, INB-115, INB-176; KC5 |
| `u` | Mark the thread read | a thread row | INB-201, INB-202; KC9 |
| `Alt+U` | Mark all read | the list | INB-90 |
| `r` | Move the focus to the row's text box: the answer box of an open ask, else the reply box; below 1280 px, first open the row over the list | a row | INB-190, INB-191, INB-193, INB-243 |
| `p` | Open the priority picker | an issue's question | INB-165 |
| `Shift+I` | Assign the issue to me | an unassigned issue's ask | INB-166, INB-175; KC6 |
| `Shift+A` | Hand this question to… | an open ask | INB-219; KC7 |
| `Shift+E` | Decline to answer… | an open question | INB-234 |
| `Shift+C` | Change answer | an answered ask, a row of Answered by you | INB-233, INB-290 |
| `Shift+Z` | Press the action of the newest toast that has one: Undo, Retry, Try again, Change answer or Open; in a text box, type the letter | everywhere | INB-331–INB-333 |
| `Shift+F10`, the Menu key | Open the row's menu | a row | none |
| arrows, `PageUp`, `PageDown`, `Space`, `Home`, `End` | Scroll the pane | the pane's scroller | INB-139 |
| `Shift+N` | Go to the next change | an approval in the pane | INB-154 |
| `Shift+D` | Show or hide the diff | a repeated approval | INB-213 |
| `←`, `→`; `Enter` | Resize the pane; put it back to 60 % | the focused divider | INB-135 |
| `Alt+Shift+F` | Clear filters | the list | INB-32, INB-84, INB-85 |
| `Backspace`, `Enter` | Remove that filter | a focused chip | INB-83, INB-84 |
| `Shift+V` | Open Display | the list | INB-86, INB-89 |
| `↓`, `↑`, `Enter`, `Escape`, `Tab` | Move, pick, close | inside a picker or a menu | INB-78, INB-87 |
| `j`, `k`, `o`, `Enter` | Move, open the ask's page | Answered by you | INB-287, INB-289 |

The drawer registers each key of the page on its dialog scope, except `l`, because the drawer has no pane (INB-280, INB-283).

| Conflict | Keys | Choice |
| --- | --- | --- |
| KC1 | Search and filter: upstream's `f` moves the focus to the search box, and a common inbox key map searches on `$mod+f` and filters on `f` | `/` moves the focus to the search box, `f` opens the Filter picker, and no command registers `$mod+f`, so it stays the browser's find (rules KB4 and LR9) |
| KC2 | Escape in the search box: upstream goes back to the row and keeps the text, and a common inbox key map clears the search | The first Escape clears typed text; in an empty box, Escape goes back to the row |
| KC3 | Enter: upstream moves the focus into the answer of the ask in hand | On an open ask, Enter takes the answer steps of R4; on each other row, it opens the row in the pane from 1280 px, in the peek below, and in the item view in the drawer (rule LR4); `o` opens the page of each row |
| KC4 | `o`: upstream opens the row's page, and a record picker can start with `o` | A bare `o` opens the row's page, no key sequence starts with `o`, and a record picker uses `g` and a letter |
| KC5 | Dismiss: upstream's `e`, and `Backspace` in a common inbox key map | One command with both keys |
| KC6 | Assign to me: the global `i` opens the drawer | `Shift+I` |
| KC7 | Hand this question to: `a` approves on the issue page | `Shift+A`, a modified key, so the rule on `a` holds |
| KC8 | Unsubscribe: `Shift+S` toggles the sidebar | No direct key: `Tab` and the palette |
| KC9 | Mark unread: Dispatch has no write that marks a thread unread | `u` marks read, and there is no mark unread |
| KC10 | Copy: upstream's `y` copies the reference | `y` and `$mod+Shift+,` copy the reference; `Shift+Y` and `$mod+.` copy the issue key (rule KB5) |
| KC11 | Undo on `$mod+z` | `$mod+z` has no app command; a toast's Undo is the undo, also on `Shift+Z` (rule KB8) |
| KC12 | `l`: a labels key elsewhere, and upstream's key into the pane | Keep `l` |
| KC13 | Show more rows of a group | `Shift+→` shows the next rows of the group in hand; there is no `Shift+←` |
