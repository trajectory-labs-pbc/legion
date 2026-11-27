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
| SHL-1 | Providers | The query client and the router | | |
| SHL-2 | Providers | `KeymapProvider` | | |
| SHL-3 | Providers | `MarginProvider` | | |
| SHL-4 | Providers | `ReferenceNamesProvider` | | |
| SHL-5 | Providers | `MarginSlotProvider` | | |
| SHL-6 | Providers | `ShellNavigationContext` | | |
| SHL-7 | Providers | `ShortcutHelpOpener` | | |
| SHL-8 | Providers | `TextAskCard` | | Its test finds the card; no test yet answers a text ask |
| SHL-9 | Background parts | `AgentRegistryPoller` | | |
| SHL-10 | Background parts | `RefPreviewHost` | | |
| SHL-11 | Background parts | `InboxDrawer` | | |
| SHL-12 | Background parts | `useRecordRecents` | | |
| SHL-13 | Background parts | The pinned agents | | |
| SHL-14 | Writes | The write store's resume | | |
| SHL-15 | Writes | `PendingWritesIndicator` | | |
| SHL-16 | Writes | `DraftsNotKept` | | |
| SHL-17 | Writes | `KeptWrites` | | |
| SHL-18 | Writes | The draft stores' sign-in and sign-out | | |
| SHL-19 | Writes | The import that registers the write kinds | | |
| SHL-20 | Sign-in | The live event feed (`useEventFeed`) | | |
| SHL-21 | Sign-in | The sign-in channel's listener | | |
| SHL-22 | Sign-in | The cache clear on a 401 | | |
| SHL-23 | Sign-in | The sign-in page | | |
| SHL-24 | Sign-in | The connection-error page | | |
| SHL-25 | Sign-in | The loading page | | |
| SHL-26 | Sign-in | Sign-out with unsent changes | | |
| SHL-27 | Layout | Live views mounted outside the routes | | |
| SHL-28 | Layout | The margin column | | |
| SHL-29 | Layout | The Details drawer | | |
| SHL-30 | Layout | The routes that fill the viewport | | |
| SHL-31 | Layout | `#main-content` with the skip link | | |
| SHL-32 | Layout | The focus move to `<main>` on a page change | | |
| SHL-33 | Layout | The connection pill | | |
| SHL-34 | Layout | The preference `shell.sidebar` | | |
| SHL-35 | Layout | The preference `shell.margin` | | |
| SHL-36 | Layout | The preference `shell.margin-width` | | |
| SHL-37 | Recovery | `DeploymentResilience` | | |
| SHL-38 | Recovery | `installChunkFailureRecovery` | | |
| SHL-39 | Recovery | The inline script in `index.html` | | |
| SHL-40 | Recovery | The two `ErrorBoundary`s | | |
| SHL-41 | Routes | The Inbox route, which serves `/` and `/credentials/*` except `/credentials/machine` | | |
| SHL-42 | Routes | The `/replies` redirect | | |
| SHL-43 | Routes | The Suspense fallbacks | changed | A page that is not an issue's loads with no issue tabs; upstream shows an issue page's tabs on every page but the frame |
| SHL-44 | Issue frame | The outline issue page's frame and icon rail | | |
