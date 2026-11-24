import { describe, expect, test } from "bun:test";

import { copyProblems, readPins, upstreamDiff } from "./copies";

describe("copied upstream code", () => {
  test("upstream has not changed a part this app copies", () => {
    const pins = readPins();
    expect(pins.length).toBeGreaterThan(20);
    const problems = copyProblems(pins);
    for (const pin of pins) {
      if (
        problems.some((line) => line.startsWith(`${pin.file} `) && line.includes(` ${pin.part} `))
      ) {
        console.error(upstreamDiff(pin));
      }
    }
    expect(problems).toEqual([]);
  });

  test("names a part upstream changed, and one it removed", () => {
    const [pin] = readPins();
    if (!pin) throw new Error("no pins");
    const changed = { ...pin, sha256: "0".repeat(64) };
    const removed = { ...pin, part: "NoSuchPart" };
    expect(copyProblems([changed, removed])).toEqual([
      `${pin.file} changed ${pin.part} since ${pin.commit.slice(0, 12)}, which ${pin.copy} copies: port the change (git diff ${pin.commit.slice(0, 12)} -- ${pin.file}), then run \`bun src/map/copies.ts --update\``,
      `${pin.file} no longer has NoSuchPart since ${pin.commit.slice(0, 12)}, which ${pin.copy} copies: port the change (git diff ${pin.commit.slice(0, 12)} -- ${pin.file}), then run \`bun src/map/copies.ts --update\``,
    ]);
  });
});
