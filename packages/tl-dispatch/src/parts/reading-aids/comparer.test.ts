import { expect, test } from "bun:test";
import { InProcessWorker } from "../../../tests/reading-aids/comparer-fixtures";
import { quietConsoleError } from "../../../tests/upstream";
import type { Block } from "./compare";
import { startComparer } from "./comparer";

const paragraph = (text: string, id: string): Block => ({ kind: "paragraph", text, id });

test("change-marks the comparer pairs the document once, then answers each block by its id", async () => {
  const comparer = startComparer(new InProcessWorker());
  const comparison = comparer.pairDocument(
    { markdown: "Kept.\n\nThe words of this paragraph stay here.\n", tree: undefined },
    [paragraph("Kept.", "a"), paragraph("The words of this paragraph stay here now.", "b")]
  );
  const block = comparer.compareBlock(paragraph("The words of this paragraph stay here.", "b"));
  expect(
    (await comparison)?.comparison.results.map((result) => [result.id, result.verdict.kind])
  ).toEqual([
    ["a", "unchanged"],
    ["b", "changed"],
  ]);
  expect(await block).toEqual({ id: "b", verdict: { kind: "unchanged" } });
});

test("change-marks a failed worker rejects what waits on it", async () => {
  const worker = new InProcessWorker();
  const comparer = startComparer(worker);
  const waiting = comparer.compareBlock(paragraph("Any.", "a"));
  worker.crash();
  await expect(waiting).rejects.toThrow("the comparison worker failed");
});

test("change-marks a failed request rejects alone, the next request still answers, and the comparer has not ended", async () => {
  quietConsoleError();
  const comparer = startComparer(new InProcessWorker(Promise.reject(new Error("no engine"))));
  const document = comparer.pairDocument({ markdown: "Text.", tree: undefined }, []);
  const block = comparer.compareBlock(paragraph("Any.", "a"));
  await expect(document).rejects.toThrow("the comparison failed");
  expect(await block).toEqual({ id: "a", verdict: { kind: "new" } });
  expect(comparer.ended()).toBe(false);
});

test("change-marks after the worker fails, the comparer has ended and each later call rejects at once", async () => {
  const worker = new InProcessWorker();
  const comparer = startComparer(worker);
  worker.crash();
  expect(comparer.ended()).toBe(true);
  await expect(comparer.compareBlock(paragraph("Any.", "a"))).rejects.toThrow(
    "the comparison worker failed"
  );
});

test("change-marks stop ends the worker and rejects what waits on it", async () => {
  const worker = new InProcessWorker();
  const comparer = startComparer(worker);
  const waiting = comparer.compareBlock(paragraph("Any.", "a"));
  comparer.stop();
  expect(worker.terminated).toBe(true);
  expect(comparer.ended()).toBe(true);
  await expect(waiting).rejects.toThrow("the comparison stopped");
});

test("change-marks the comparer hands back the document's pairs, and a compare by them keeps them", async () => {
  const baseline = { markdown: "The design keeps most of its words today.\n", tree: undefined };
  const edited = paragraph("The design keeps most of its words now.", "d");
  const first = await startComparer(new InProcessWorker()).pairDocument(baseline, [edited]);
  if (first === undefined) throw new Error("no pairs");
  const again = await startComparer(new InProcessWorker()).compareDocument(first.pairs, [
    paragraph("Inserted above.", "n"),
    edited,
  ]);
  expect(again.results.map(({ id, verdict }) => [id, verdict.kind])).toEqual([
    ["n", "new"],
    ["d", "changed"],
  ]);
});

test("change-marks a baseline the engine refuses answers no comparison", async () => {
  const comparer = startComparer(new InProcessWorker());
  const refused = { markdown: "Text.", tree: { type: "not-a-document" } };
  expect(await comparer.pairDocument(refused, [])).toBeUndefined();
});
