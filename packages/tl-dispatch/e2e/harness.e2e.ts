import { readFileSync } from "node:fs";

import { entryChunk } from "../scripts/check-entry-budget";
import { WEB_DISTS } from "./dists";
import { deployed, expect, test } from "./test";

test("the local server serves this app's build", async ({ request }) => {
  test.skip(deployed, "a deployed server serves the build it was deployed with");
  const built = entryChunk(readFileSync(`${WEB_DISTS["tl-dispatch"]}/index.html`, "utf8"));
  expect(entryChunk(await (await request.get("/")).text())).toBe(built);
});
