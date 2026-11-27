# Document

The two regions of upstream's `ProofDocument.tsx` above a document's text that the reading aids replace.
"Read first" (`src/features/reading-aids/read-first.tsx`) rebuilds the Open-decisions navigator. Where Read first shows, the "Changed since you last read" line is hidden; the fork does not draw it yet.
Each row of a rebuilt region needs a test whose name starts with its ID.
`scripts/check-parity.ts` holds this list to the tests.

| Region | Rebuilt |
| --- | --- |
| Open decisions | yes |
| Changed since you last read | no |

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| DOC-1 | Open decisions | The count of the document's open decisions, with one of them as a link | changed | Read first lists each open decision on its own line, in the document's order |
| DOC-2 | Open decisions | A click on the decision sets its `#b-` anchor and moves to its block | changed | The focus then goes to the host element, not into the editor, so a typed letter changes nothing |
| DOC-3 | Open decisions | The next button walks the open decisions and wraps | changed | The `d` and `Shift+D` keys walk them both ways and wrap; there is no button |
| DOC-4 | Open decisions | No navigator when the document has no open decision | changed | Read first stays and says "No open requests or decisions" |
| DOC-5 | Open decisions | An answered decision leaves the navigator | | |
| DOC-6 | Open decisions | No navigator in a pane or under `?v=` | | |
| DOC-7 | Open decisions | The question is drawn as its plain words | | |
| DOC-8 | Changed since you last read | The line names what changed since the reader's last read of the spec | changed | Hidden where Read first shows; it still shows in an outline row's editor |
| DOC-9 | Changed since you last read | No line off the spec's own page or under `?v=` | | |
