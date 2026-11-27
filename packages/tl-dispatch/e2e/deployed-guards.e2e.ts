// The deployed mode's guards on the person's session (test.ts), against the server they guard.
import { baseUrl, devSignInPath } from "../../dispatch/e2e/api";
import { SIGN_OUT } from "./modes";
import { deployed, expect, test } from "./test";

test.skip(!deployed, "the guards are the deployed mode's");

test("a page's sign-out is aborted, and the session still signs in", async ({ page }) => {
  await page.goto("/");
  const outcome = await page.evaluate(async (path) => {
    try {
      return String((await fetch(path, { method: "POST" })).status);
    } catch {
      return "aborted";
    }
  }, SIGN_OUT);
  expect(outcome).toBe("aborted");
  expect(await page.evaluate(async () => (await fetch("/auth/whoami")).status)).toBe(200);
});

test("this worker's fetch refuses a sign-out and a dev sign-in", async () => {
  await expect(fetch(new URL(SIGN_OUT, baseUrl), { method: "POST" })).rejects.toThrow(
    "refuses a sign-out"
  );
  await expect(fetch(new URL(devSignInPath("alice"), baseUrl))).rejects.toThrow(
    "signs in at dev sign-in"
  );
});
