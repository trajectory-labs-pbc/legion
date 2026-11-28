import { expect, test } from "bun:test";
import { compiledBlockSchema, createHeadlessProof } from "@/upstream/editor/worker";
import { quietConsoleError } from "../../../tests/upstream";

import type { Block } from "./compare";
import { type CompareReply, type CompareRequest, createCompareSession } from "./compare.worker";
import { type CompareWorker, startComparer } from "./comparer";

const engine = createHeadlessProof({ blockSchema: compiledBlockSchema, readOnly: true });

/** The worker in process: each request is answered by the worker's own session, on a later task. */
class InProcessWorker implements CompareWorker {
  terminated = false;
  private crashed = false;
  private readonly answer: ReturnType<typeof createCompareSession>;
  private readonly onMessage: ((event: MessageEvent<CompareReply>) => void)[] = [];
  private readonly onError: ((event: Event) => void)[] = [];

  constructor(withEngine = engine) {
    this.answer = createCompareSession(withEngine);
  }

  addEventListener(type: "message", listener: (event: MessageEvent<CompareReply>) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  addEventListener(
    type: "message" | "error",
    listener: ((event: MessageEvent<CompareReply>) => void) & ((event: Event) => void)
  ): void {
    (type === "message" ? this.onMessage : this.onError).push(listener);
  }

  postMessage(request: CompareRequest): void {
    if (this.crashed) return;
    void this.answer(request).then((reply) => {
      for (const listener of this.onMessage) listener(new MessageEvent("message", { data: reply }));
    });
  }

  crash(): void {
    this.crashed = true;
    for (const listener of this.onError) listener(new Event("error"));
  }

  terminate(): void {
    this.terminated = true;
  }
}

const paragraph = (text: string, id: string): Block => ({ kind: "paragraph", text, id });

test("change-marks the comparer pairs the document once, then answers each block by its id", async () => {
  const comparer = startComparer(new InProcessWorker());
  const comparison = comparer.compareDocument(
    { markdown: "Kept.\n\nThe words of this paragraph stay here.\n", tree: undefined },
    [paragraph("Kept.", "a"), paragraph("The words of this paragraph stay here now.", "b")]
  );
  const block = comparer.compareBlock(paragraph("The words of this paragraph stay here.", "b"));
  expect((await comparison)?.results.map((result) => [result.id, result.verdict.kind])).toEqual([
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

test("change-marks a failed request rejects alone, and the next request still answers", async () => {
  quietConsoleError();
  const comparer = startComparer(new InProcessWorker(Promise.reject(new Error("no engine"))));
  const document = comparer.compareDocument({ markdown: "Text.", tree: undefined }, []);
  const block = comparer.compareBlock(paragraph("Any.", "a"));
  await expect(document).rejects.toThrow("the comparison failed");
  expect(await block).toEqual({ id: "a", verdict: { kind: "new" } });
});

test("change-marks after the worker fails, each later call rejects at once", async () => {
  const worker = new InProcessWorker();
  const comparer = startComparer(worker);
  worker.crash();
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
  await expect(waiting).rejects.toThrow("the comparison stopped");
});
