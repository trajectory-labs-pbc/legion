import type { ChangeBaseline } from "@/upstream/editor/engine";
import {
  compiledBlockSchema,
  createHeadlessProof,
  type DocumentJSON,
  documentFromJSON,
  type HeadlessProofEditor,
} from "@/upstream/editor/worker";

import {
  type BaselineBlock,
  type Block,
  type BlockVerdict,
  type Comparison,
  compareBlock,
  compareDocument,
  NO_PAIRS,
  type Pairs,
  type Result,
  readBlocks,
} from "./compare";

export type CompareRequest =
  | {
      readonly id: number;
      readonly kind: "document";
      readonly baseline: ChangeBaseline;
      readonly live: readonly Block[];
    }
  | { readonly id: number; readonly kind: "block"; readonly block: Block };

/** `comparison` is `undefined` for a baseline the engine refuses; "failed" is a request that
 *  threw. */
export type CompareReply =
  | { readonly id: number; readonly kind: "document"; readonly comparison: Comparison | undefined }
  | { readonly id: number; readonly kind: "block"; readonly result: Result<BlockVerdict> }
  | { readonly id: number; readonly kind: "failed" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMarkJSON(value: unknown): boolean {
  return isRecord(value) && typeof value.type === "string" && optionalRecord(value.attrs);
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

/** The server's tree read as the JSON `documentFromJSON` takes. */
function isDocumentJSON(value: unknown): value is DocumentJSON {
  if (!isRecord(value) || typeof value.type !== "string" || !optionalRecord(value.attrs)) {
    return false;
  }
  const { content, marks, text } = value;
  return (
    (text === undefined || typeof text === "string") &&
    (content === undefined || (Array.isArray(content) && content.every(isDocumentJSON))) &&
    (marks === undefined || (Array.isArray(marks) && marks.every(isMarkJSON)))
  );
}

/** The baseline's blocks, read as upstream's change marks read it: its tree where the answer
 *  carries one, else its markdown parsed. `undefined` for one the engine refuses. */
function baselineBlocks(
  proof: HeadlessProofEditor,
  baseline: ChangeBaseline
): BaselineBlock[] | undefined {
  // The engine reads an empty text as one empty paragraph; it holds no block.
  if (baseline.markdown === "") return [];
  const { tree } = baseline;
  try {
    if (tree === undefined) return readBlocks(proof.parseMarkdown(baseline.markdown));
    return isDocumentJSON(tree) && tree.type === proof.schema.topNodeType.name
      ? readBlocks(documentFromJSON(proof.schema, tree))
      : undefined;
  } catch {
    return undefined;
  }
}

/** One editor's comparison: the pairs made by the document request, read by each block request.
 *  Requests answer in order, so a block request waits for the document request before it. */
export function createCompareSession(
  engine: Promise<HeadlessProofEditor>
): (request: CompareRequest) => Promise<CompareReply> {
  let pairs: Pairs = NO_PAIRS;
  const answerOne = async (request: CompareRequest): Promise<CompareReply> => {
    if (request.kind === "block") {
      const { block } = request;
      return {
        id: request.id,
        kind: "block",
        result: { id: block.id, verdict: compareBlock(pairs, block) },
      };
    }
    pairs = NO_PAIRS;
    const baseline = baselineBlocks(await engine, request.baseline);
    if (baseline === undefined) {
      return { id: request.id, kind: "document", comparison: undefined };
    }
    const compared = compareDocument(baseline, request.live);
    pairs = compared.pairs;
    return { id: request.id, kind: "document", comparison: compared.comparison };
  };
  let queue: Promise<unknown> = Promise.resolve();
  return (request) => {
    const reply = queue.then(async (): Promise<CompareReply> => {
      try {
        return await answerOne(request);
      } catch (error) {
        console.error("Comparing with the baseline failed", error);
        return { id: request.id, kind: "failed" };
      }
    });
    queue = reply;
    return reply;
  };
}

// A page has no `WorkerGlobalScope`: nothing listens where a test imports this module.
if ("WorkerGlobalScope" in globalThis) {
  const answer = createCompareSession(
    createHeadlessProof({ blockSchema: compiledBlockSchema, readOnly: true })
  );
  self.addEventListener("message", (event: MessageEvent<CompareRequest>) => {
    void answer(event.data).then((reply) => {
      self.postMessage(reply);
    });
  });
}
