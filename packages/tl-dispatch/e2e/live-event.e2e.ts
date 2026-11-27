// A live event updates an open page: the issue page shows a title the agent changes through the
// API, with no reload (upstream's event feed, which the shell mounts).
import { patchIssue } from "../../dispatch/e2e/api";
import { AGENT, markDocument, runIssue, sameDocument } from "./flows";
import { expect, runName, test } from "./test";

test("a change made through the API shows on the open page, with no reload", async ({ page }) => {
  const issue = await runIssue(page, "live issue");
  const heading = (name: string) => page.getByRole("heading", { exact: true, level: 1, name });

  await page.goto(`/issues/${issue}`);
  await expect(heading(`${runName} live issue`)).toBeVisible();
  await markDocument(page);

  const changed = `${runName} live issue changed`;
  await patchIssue(issue, { title: changed }, AGENT);
  await expect(heading(changed)).toBeVisible();
  expect(await sameDocument(page), "the page was not loaded again").toBe(true);
});
