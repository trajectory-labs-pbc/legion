// The aids' states as light and dark pictures, which CI keeps as an artifact.
import { fileURLToPath } from "node:url";

import { expect, test } from "../test";
import { compareWith, revisitSpec, seedReadThenRevised, sinceText } from "./baseline-seed";
import { openHost } from "./hosts";
import { readFirst, readFirstListed, seedDecided } from "./read-first-seed";

const SCREENSHOTS = fileURLToPath(new URL("../screenshots/", import.meta.url));

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test(`screenshots: Read first with a request over two documents and three decisions, ${colorScheme}`, async ({
      page,
    }) => {
      const { path } = await seedDecided(page, "spec");
      await openHost(page, path);
      await readFirstListed(page);
      await expect(readFirst(page)).toBeInViewport();
      await page.screenshot({ path: `${SCREENSHOTS}read-first-${colorScheme}.png` });
    });

    test(`screenshots: the counts line since the version last read, and Compare with open, ${colorScheme}`, async ({
      page,
    }) => {
      const seeded = await seedReadThenRevised(page);
      await revisitSpec(page, seeded);
      const since = sinceText(page, `Since v${seeded.read}, the version you last read`);
      await expect(since).toBeInViewport();
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}baseline-since-${colorScheme}.png`,
      });
      await compareWith(page).click();
      await expect(page.getByRole("listbox")).toBeInViewport();
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}baseline-compare-with-${colorScheme}.png`,
      });
    });
  });
}
