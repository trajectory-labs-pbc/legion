import { SendStoppedError, stoppedWriteNote } from "@upstream-dispatch/features/writes/keyed-write";

export interface WriteFailureText {
  /** The write, as the sentence names it: `the approval`. */
  what: string;
  /** What pressing the surface's control again sends, since a stopped write may have been made. */
  anew: string;
  /** What to say of any other failure. */
  refused: (error: unknown) => string;
}

/** What a surface says of its failed write: one the reader stopped may have been made. */
export function writeFailureNote(
  error: unknown,
  { what, anew, refused }: WriteFailureText
): string {
  return error instanceof SendStoppedError
    ? stoppedWriteNote(what, "made", { anew })
    : refused(error);
}
