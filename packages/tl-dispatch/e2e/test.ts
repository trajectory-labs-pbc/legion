// The `test` of this app's browser tests, for both modes (modes.ts).
//
// Local: upstream's own `test` (packages/dispatch/e2e/test.ts). Each test starts from an emptied
// database, and Playwright's `context` is signed in at dev sign-in.
//
// Deployed: the same `test` with the reset and the sign-in taken out. Each context carries the
// config's storage state, nothing empties a database, and a test that signs in (`signedIn`) is
// refused. A sign-out would end every session of the signed-in person, so two paths refuse it:
// this worker's `fetch`, which upstream's api.ts seeds through, refuses dev sign-in (a seed
// `as: "user"`) and sign-out; and the `context` this `test` gives, with its pages, aborts the
// browser's sign-out. Neither reaches `page.request`, `context.request` or a context a test
// makes with `browser.newContext()`, so a deployed-mode test sends nothing through those.
// Upstream's users.ts helpers sign in through `context.request` at dev sign-in, which a deployed
// Dispatch does not serve.
import { test as upstreamTest } from "../../dispatch/e2e/test";
import { isDeployed, nameRun, refusingSignInAndOut, SIGN_OUT } from "./modes";

export const deployed = isDeployed();

if (deployed) {
  globalThis.fetch = refusingSignInAndOut(globalThis.fetch);
}

export const test = deployed
  ? upstreamTest.extend({
      // Overrides keep upstream's options (`freshDatabase` stays automatic).
      signedIn: false,
      // Upstream's `context` names this fixture, so it runs before upstream's sign-in, and it
      // empties nothing.
      freshDatabase: async ({ signedIn }, use) => {
        if (signedIn !== false) {
          throw new Error(
            `The deployed mode refuses signedIn: ${signedIn}, a sign-in at dev sign-in. ` +
              "Each context carries the storage state E2E_STORAGE_STATE names."
          );
        }
        await use(undefined);
      },
      // Only a test that takes `context` or `page` builds one.
      context: async ({ context }, use) => {
        await context.route(`**${SIGN_OUT}`, (route) => route.abort());
        await use(context);
      },
    })
  : upstreamTest;

/** The name of this run: each record a test makes carries it, and a test reads only those. */
export const runName = nameRun();

export type { Page } from "../../dispatch/e2e/test";
export { expect } from "../../dispatch/e2e/test";
