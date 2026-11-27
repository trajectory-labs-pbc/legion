# Document

The two regions of upstream's `ProofDocument.tsx` above a document's text that the reading aids replace.
"Read first" (`src/parts/reading-aids/read-first.tsx`) rebuilds the Open-decisions navigator, and the counts line (`src/parts/reading-aids/counts-line.tsx`) rebuilds the "Changed since you last read" line. Where Read first shows, upstream's two are hidden.
Each row of a rebuilt region needs a test whose name starts with its ID.
`scripts/check-parity.ts` holds this list to the tests.

| Region | Rebuilt |
| --- | --- |
| Open decisions | yes |
| Changed since you last read | yes |

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| DOC-1 | Open decisions | The count of the document's open decisions, with one of them as a link | changed | Read first lists each open decision on its own line, in the document's order |
| DOC-2 | Open decisions | A click on the decision sets its `#b-` anchor and moves to its block | changed | The focus then goes to the host element, not into the editor, so a typed letter changes nothing |
| DOC-3 | Open decisions | The next button walks the open decisions and wraps | changed | The `d` and `Shift+D` keys walk them both ways and wrap; there is no button |
| DOC-4 | Open decisions | No navigator when the document has no open decision | changed | Read first stays and says "No open requests or decisions" |
| DOC-5 | Open decisions | An answered decision leaves the navigator | | |
| DOC-6 | Open decisions | No navigator in a pane or under `?v=` | | |
| DOC-7 | Open decisions | The question is drawn as its plain words | | |
| DOC-8 | Changed since you last read | The line names what changed since the reader's last read of the spec | changed | The counts line counts the changed blocks against the baseline and links each changed section; upstream's line is hidden where Read first shows, and still shows in an outline row's editor |
| DOC-9 | Changed since you last read | No line off the spec's own page or under `?v=` | changed | The counts line shows on each document Read first shows on; off the spec's page it takes no read mark, so with no request approved before it has no earlier version; under `?v=` no part shows (DOC-6) |
