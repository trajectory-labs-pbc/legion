// The unit tests' comparer: the worker's own session, run in the test's process.
import { createHeadlessProof } from "@legion/proof-editor/headless";
import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";
import { compiledBlockSchema } from "@upstream-dispatch/features/doc/schema";
import * as Y from "yjs";

import { aidedEditor } from "./aided-editor";
import { type CompareReply, type CompareRequest, createCompareSession } from "./compare.worker";
import { type Comparer, type CompareWorker, startComparer } from "./comparer";
import * as editorAids from "./editor-aids";
import { keep, options } from "./editor-fixtures";
import type { Against } from "./marks-session";

const engine = createHeadlessProof({ blockSchema: compiledBlockSchema, readOnly: true });

/** `baseline` as a pick of v8 names it. */
export const against = (baseline: ChangeBaseline): Against => ({
  baseline,
  choice: { kind: "chosen", version: 8 },
});

/** The worker in process: each request is answered by the worker's own session, on a later task. */
export class InProcessWorker implements CompareWorker {
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

/** A comparer on an in-process worker: it records each block sent alone, held while `gate.held`. */
export function inProcess() {
  const worker = new InProcessWorker();
  const started = startComparer(worker);
  const sent: string[] = [];
  const waiting: (() => void)[] = [];
  const gate = {
    held: false,
    release: () => {
      for (const go of waiting.splice(0)) go();
    },
  };
  const comparer: Comparer = {
    ...started,
    async compareBlock(block) {
      sent.push(block.text);
      if (gate.held) await new Promise<void>((go) => waiting.push(go));
      return started.compareBlock(block);
    },
  };
  return { comparer, gate, sent, worker };
}

const inProcessAidedEditor = aidedEditor(async () => ({
  ...editorAids,
  installAids: (editor, host, documentRef) =>
    editorAids.installAids(editor, host, documentRef, () => inProcess().comparer),
}));

/** An aided editor in `root` on a new document, its change marks compared in the test's process. */
export const inProcessEditorIn = async (root: HTMLElement, documentRef: string | undefined) =>
  keep(await inProcessAidedEditor(root, options(new Y.Doc(), documentRef)));
