import { AttentionMark } from "@legion/ui/components/attention-mark";
import type { ComponentProps } from "react";

/** What waits on the reader, in the one mark and the one wording; nothing at zero. */
export function NeedsYouMark({
  count,
  ...props
}: Omit<ComponentProps<typeof AttentionMark>, "label">) {
  if (count === 0) return null;
  return (
    <AttentionMark
      count={count}
      label={count === undefined ? "Needs you" : `Needs you: ${count}`}
      {...props}
    />
  );
}
