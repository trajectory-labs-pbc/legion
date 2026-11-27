import type { ChangeBaseline } from "@/upstream/editor/engine";

import type { Block, BlockVerdict, Comparison, Result } from "./compare";
import type { CompareReply, CompareRequest } from "./compare.worker";

/** The part of a `Worker` the comparer uses. */
export interface CompareWorker {
  postMessage(request: CompareRequest): void;
  addEventListener(type: "message", listener: (event: MessageEvent<CompareReply>) => void): void;
  addEventListener(type: "error", listener: (event: Event) => void): void;
  terminate(): void;
}

/** The main thread's side of one editor's comparison, which runs in the worker. */
export interface Comparer {
  /** Pairs the blocks once; `undefined` for a baseline the engine refuses. */
  compareDocument(
    baseline: ChangeBaseline,
    live: readonly Block[]
  ): Promise<Comparison | undefined>;
  /** One block against its paired baseline block, by its id. */
  compareBlock(block: Block): Promise<Result<BlockVerdict>>;
  stop(): void;
}

interface Waiting {
  resolve(reply: CompareReply): void;
  reject(error: Error): void;
}

export function startComparer(
  // One expression, the shape the bundler reads as a worker entry.
  worker: CompareWorker = new Worker(new URL("./compare.worker.ts", import.meta.url), {
    type: "module",
  })
): Comparer {
  const waiting = new Map<number, Waiting>();
  let nextId = 0;
  let ended: Error | undefined;

  const end = (error: Error) => {
    ended = error;
    for (const each of waiting.values()) each.reject(error);
    waiting.clear();
  };

  worker.addEventListener("message", ({ data: reply }) => {
    waiting.get(reply.id)?.resolve(reply);
    waiting.delete(reply.id);
  });
  worker.addEventListener("error", () => {
    end(new Error("the comparison worker failed"));
  });

  const send = (request: (id: number) => CompareRequest): Promise<CompareReply> => {
    if (ended !== undefined) return Promise.reject(ended);
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      worker.postMessage(request(id));
    });
  };

  return {
    async compareDocument(baseline, live) {
      const reply = await send((id) => ({ id, kind: "document", baseline, live }));
      if (reply.kind !== "document") throw new Error("the comparison failed");
      return reply.comparison;
    },
    async compareBlock(block) {
      const reply = await send((id) => ({ id, kind: "block", block }));
      if (reply.kind !== "block") throw new Error("the comparison failed");
      return reply.result;
    },
    stop() {
      worker.terminate();
      end(new Error("the comparison stopped"));
    },
  };
}
