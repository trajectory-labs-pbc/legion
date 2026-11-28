# Machine login

The machine login page, `/credentials/machine`, which the fork rebuilt.
This list holds only the items that the page's tests already named by ID, so it is an inventory of those tests, not yet a full list of upstream's page.
`scripts/check-parity.ts` holds it to the tests.

| Region | Rebuilt |
| --- | --- |
| Route | yes |
| Code form | yes |
| Machine logins | yes |
| Revoke | yes |

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| MLR-01 | Route | A Dispatch without the device grant shows the fork's not-found page | | |
| MLR-02 | Route | A Dispatch with the device grant shows the machine login page | | |
| MLR-03 | Route | A page skeleton after 200 ms while the capabilities answer is out | | |
| MLR-04 | Route | A failed capabilities read says so, and Retry asks again where asking again can work | changed | Upstream's route shows its not-found page for every failed read. Here a failure that a second ask can clear says so, with Retry |
| MLR-05 | Route | The logins list is read beside the capabilities read, not after the page mounts | | |
| MLR-06 | Route | A refused capabilities read says so, with no Retry | changed | Upstream's route shows its not-found page; a 403 here says the reader cannot see the page |
| MLR-07 | Route | A capabilities read the server cannot find shows the not-found page | | |
| MLR-08 | Route | A logins list refused before the route mounts again loads, with no failure, until the server answers again | | |
| MLP-01 | Code form | Look up, then Approve, posts the looked-up code | | |
| MLP-02 | Code form | A lookup failure shows under the code field | | |
| MLP-03 | Code form | Look up, then Deny, posts the looked-up code | | |
| MLP-04 | Code form | A pending service login offers Deny alone | | |
| MLP-05 | Code form | A lookup the reader stopped says it may have been made | | |
| MLP-06 | Code form | An approval the reader stopped says it may have been made | | |
| MLP-07 | Code form | A denial the reader stopped says it may have been made | | |
| MLP-08 | Code form | Approve keeps the focus while it is out, Deny waits for it, and a refusal is announced | | |
| MLP-09 | Code form | Look up waits for a code, keeps the focus while it is out, and a refused lookup is announced | | |
| MLP-10 | Code form | Deny keeps the focus while it is out, Approve waits for it, and a refusal is announced | | |
| MLD-01 | Code form | After Approve succeeds, the page shows the decision and no decision buttons | | |
| MLD-02 | Code form | After Deny succeeds, the page shows the decision and no decision buttons | | |
| MLD-03 | Code form | A looked-up login already approved shows its decision and no decision buttons | | |
| MLD-04 | Code form | A looked-up login already denied shows its decision and no decision buttons | | |
| MLD-05 | Code form | A looked-up login that expired before the sweep offers no decision | | |
| MLD-06 | Code form | A looked-up login that expired after the sweep offers no decision | | |
| MLD-07 | Code form | A looked-up approved service's login says it starts worker pods as the service | | |
| MLS-01 | Machine logins | An expired login whose sessions still run is listed and marked so | | |
| MLS-02 | Machine logins | A revoke refreshes the live grants | | |
| MLS-03 | Machine logins | The page lists the reader's machine logins, and Revoke ends the one confirmed | | |
| MLS-04 | Machine logins | A service's login that someone else approved names its service and its approver | | |
| MLS-05 | Machine logins | A service's login from a broker that sends no subject shows as one a person approved | | |
| MLS-06 | Machine logins | A service's token login names its service account | | |
| MLS-07 | Machine logins | A person's pod login reads as the reader's own pod | | |
| MLS-08 | Machine logins | Two logins of one service on one host are told apart by their credential IDs | | |
| MLS-09 | Machine logins | A login approved on the page joins the list | | |
| MLS-10 | Machine logins | A cut name or approver is a button that shows it in full in its tooltip | | |
| MLS-11 | Machine logins | A machine logins read the server cannot find says so, with no Retry | changed | Upstream's list offers Retry for every failed read; a 404 cannot change on a second ask |
| MLS-12 | Machine logins | A machine logins read the server refuses says so, with no Retry | changed | Upstream's list offers Retry for every failed read; a 403 cannot change on a second ask |
| RVL-01 | Revoke | The pressed Revoke shows that its revoke is out and keeps the focus | | |
| RVL-02 | Revoke | A double press on the question's Revoke sends one revoke | | |
| RVL-03 | Revoke | A refused revoke shows the broker's refusal under its row | | |
| RVL-04 | Revoke | A refused revoke's line goes once its row leaves the list | | |
| RVL-05 | Revoke | A revoke refreshes the list | | |
| RVL-06 | Revoke | A revoke the reader stopped says it may have been made | | |
| RVL-07 | Revoke | A list that fails to load says so, with a Retry | | |
| RVL-08 | Revoke | A revoked row hands the focus to a listed Revoke, or above the list | | |
| RVL-09 | Revoke | A loaded list whose refresh fails keeps its rows and says so | | |
| RVL-10 | Revoke | A revoked row hands the focus to a listed Revoke, not to a cut name drawn before it | | |
| RVL-11 | Revoke | A revoked row hands the focus to the next row's Revoke | | |
| RVL-12 | Revoke | The last row, once revoked, hands the focus to the row before it | | |
| RVL-13 | Revoke | A loaded list whose refresh is refused keeps its rows and says so, with no Retry | changed | Upstream's list offers Retry for every failed refresh; a 403, a 404 or a 400 other than `INVALID_QUERY` cannot change on a second ask |
