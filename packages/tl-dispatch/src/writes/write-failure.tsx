import { Alert, AlertTitle } from "@legion/ui/components/alert";
import { type WriteFailureText, writeFailureNote } from "./write-failure-note";

/** A failed write, announced: what the surface says of it, in a compact danger alert. */
export function WriteFailure({ error, ...text }: WriteFailureText & { error: unknown }) {
  return (
    <Alert size="compact" variant="danger">
      <AlertTitle>{writeFailureNote(error, text)}</AlertTitle>
    </Alert>
  );
}
