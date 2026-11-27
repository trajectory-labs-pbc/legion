// Throwaway (not for merge): screenshot the pages track-shots.tsx wrote.
import { resolve } from "node:path";
import { chromium } from "playwright";

const dir = resolve(process.argv[2] ?? "shots");
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ deviceScaleFactor: 2, colorScheme: scheme });
  await page.goto(`file://${dir}/${scheme}.html`);
  await page.locator("body > div").screenshot({ path: `${dir}/track-${scheme}.png` });
}
await browser.close();
