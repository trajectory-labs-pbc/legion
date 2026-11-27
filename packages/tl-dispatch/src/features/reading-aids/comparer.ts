import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";

import type { Block, BlockVerdict, Comparison, Pairs, Result } from "./compare";
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
  /** Pairs the blocks with the baseline's and compares them; `undefined` for a refused baseline. */
  pairDocument(
    baseline: ChangeBaseline,
    live: readonly Block[]
  ): Promise<{ comparison: Comparison; pairs: Pairs } | undefined>;
  /** Compares the blocks by an earlier editor's pairs against the same baseline. */
  compareDocument(pairs: Pairs, live: readonly Block[]): Promise<Comparison>;
  /** One block against its paired baseline block, by its id. */
  compareBlock(block: Block): Promise<Result<BlockVerdict>>;
  /** Whether the worker failed or the comparer stopped: each later call is rejected. */
  ended(): boolean;
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
  let endedBy: Error | undefined;

  const end = (error: Error) => {
    endedBy = error;
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
    if (endedBy !== undefined) return Promise.reject(endedBy);
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      worker.postMessage(request(id));
    });
  };

  return {
    async pairDocument(baseline, live) {
      const reply = await send((id) => ({ baseline, id, kind: "pair", live }));
      if (reply.kind === "refused") return undefined;
      if (reply.kind !== "pair") throw new Error("the comparison failed");
      return reply;
    },
    async compareDocument(pairs, live) {
      const reply = await send((id) => ({ id, kind: "compare", live, pairs }));
      if (reply.kind !== "compare") throw new Error("the comparison failed");
      return reply.comparison;
    },
    async compareBlock(block) {
      const reply = await send((id) => ({ id, kind: "block", block }));
      if (reply.kind !== "block") throw new Error("the comparison failed");
      return reply.result;
    },
    ended: () => endedBy !== undefined,
    stop() {
      worker.terminate();
      end(new Error("the comparison stopped"));
    },
  };
}
