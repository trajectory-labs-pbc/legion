// A sign-in in one tab reaches a second tab of the browser: the tab on the sign-in page leaves it
// with no reload, told by the sign-in channel (src/data/use-sign-in-channel.ts).
import { markDocument, personCookies, personOf, sameDocument } from "./flows";
import { expect, test } from "./test";

test("a sign-in reaches a tab on the sign-in page, which leaves it with no reload", async ({
  emptyContext: context,
}) => {
  const first = await context.newPage();
  await first.goto("/");
  const signInLink = first.getByRole("link", { name: "Sign in with Google" });
  await expect(signInLink).toBeVisible();
  await markDocument(first);

  // As a sign-in does, the browser gets the session cookie; the second tab opens signed in.
  await context.addCookies(await personCookies());
  const second = await context.newPage();
  await second.goto("/");
  const signedIn = `Signed in as ${await personOf(second)}`;
  await expect(second.getByText(signedIn)).toBeVisible();

  await expect(first.getByText(signedIn)).toBeVisible();
  await expect(signInLink).toHaveCount(0);
  expect(await sameDocument(first), "the first tab was not loaded again").toBe(true);
});
