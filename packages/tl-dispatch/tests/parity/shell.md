# Shell

The duties of upstream's shell (`app.tsx`) that the new shell does, each copied or rebuilt.
A row's region is the group of duties it belongs to.
The fork draws the whole shell, so each region is rebuilt, and each row needs a test whose name starts with its ID.
A row with no test yet is marked `untested`; the mark goes when the test comes, and no row has it at the exit of the foundation and shell phase.
The package's README, "Checks", has the rules.

| Region | Rebuilt |
| --- | --- |
| Providers | yes |
| Background parts | yes |
| Writes | yes |
| Sign-in | yes |
| Layout | yes |
| Recovery | yes |
| Routes | yes |
| Issue frame | yes |

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| SHL-1 | Providers | The query client and the router | untested | No test mounts the shell under its query client and router |
| SHL-2 | Providers | `KeymapProvider` | untested | No test presses a shortcut through the shell's keymap |
| SHL-3 | Providers | `MarginProvider` | untested | No test reads the margin's state through the shell |
| SHL-4 | Providers | `ReferenceNamesProvider` | untested | No test resolves a reference's name through the shell |
| SHL-5 | Providers | `MarginSlotProvider` | untested | No test fills the margin slot through the shell |
| SHL-6 | Providers | `ShellNavigationContext` | untested | No test navigates through the shell's navigation context |
| SHL-7 | Providers | `ShortcutHelpOpener` | untested | No test opens the shortcut help from the shell |
| SHL-8 | Providers | `TextAskCard` | untested | No test answers a text ask through the shell's card |
| SHL-9 | Background parts | `AgentRegistryPoller` | untested | No test polls the agent registry from the shell |
| SHL-10 | Background parts | `RefPreviewHost` | untested | No test opens a reference's preview from the shell |
| SHL-11 | Background parts | `InboxDrawer` | | |
| SHL-12 | Background parts | `useRecordRecents` | untested | No test records a visited page in the recents |
| SHL-13 | Background parts | The pinned agents | untested | The pins' move is tested; the live views' pins (`setPinned`) are not |
| SHL-14 | Writes | The write store's resume | untested | No test resumes an unsent write after a reload |
| SHL-15 | Writes | `PendingWritesIndicator` | untested | No test shows the count of pending writes |
| SHL-16 | Writes | `DraftsNotKept` | untested | No test shows the notice of drafts not kept |
| SHL-17 | Writes | `KeptWrites` | untested | No test shows the kept writes |
| SHL-18 | Writes | The draft stores' sign-in and sign-out | untested | No test moves the drafts on sign-in and clears them on sign-out |
| SHL-19 | Writes | The import that registers the write kinds | untested | No test sends a write of each kind after the shell loads |
| SHL-20 | Sign-in | The live event feed (`useEventFeed`) | untested | No test applies a live event to the cache |
| SHL-21 | Sign-in | The sign-in channel's listener | | |
| SHL-22 | Sign-in | The cache clear on a 401 | | |
| SHL-23 | Sign-in | The sign-in page | | |
| SHL-24 | Sign-in | The connection-error page | | |
| SHL-25 | Sign-in | The loading page | | |
| SHL-26 | Sign-in | Sign-out with unsent changes | | |
| SHL-27 | Layout | Live views mounted outside the routes | untested | No test keeps a live view mounted across a route change |
| SHL-28 | Layout | The margin column | untested | No test draws the margin column beside a page |
| SHL-29 | Layout | The Details drawer | | |
| SHL-30 | Layout | The routes that fill the viewport | | |
| SHL-31 | Layout | `#main-content` with the skip link | | |
| SHL-32 | Layout | The focus move to `<main>` on a page change | | |
| SHL-33 | Layout | The connection pill | untested | Only the hidden pill is tested; the reconnecting and stuck pills are not |
| SHL-34 | Layout | The preference `shell.sidebar` | | |
| SHL-35 | Layout | The preference `shell.margin` | | |
| SHL-36 | Layout | The preference `shell.margin-width` | | |
| SHL-37 | Recovery | `DeploymentResilience` | untested | No test reloads the app on a new deployment |
| SHL-38 | Recovery | `installChunkFailureRecovery` | | |
| SHL-39 | Recovery | The inline script in `index.html` | untested | No test runs the inline script's recovery before the app loads |
| SHL-40 | Recovery | The two `ErrorBoundary`s | untested | No test draws an error boundary's fallback |
| SHL-41 | Routes | The Inbox route, which serves `/` and `/credentials/*` except `/credentials/machine` | | |
| SHL-42 | Routes | The `/replies` redirect | | |
| SHL-43 | Routes | The Suspense fallbacks | changed | A page that is not an issue's loads with no issue tabs; upstream shows an issue page's tabs on every page but the frame |
| SHL-44 | Issue frame | The outline issue page's frame and icon rail | untested | No test draws an issue in the outline frame with its icon rail |
