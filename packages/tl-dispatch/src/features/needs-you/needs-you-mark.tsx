import { AttentionMark } from "@legion/ui/components/attention-mark";
import type { ComponentProps } from "react";

/** The one wording of what waits on the reader. */
export const needsYouLabel = (count: number) => `Needs you: ${count}`;

/** What waits on the reader, in the one mark and the one wording; nothing at zero. */
export function NeedsYouMark({
  count,
  ...props
}: Omit<ComponentProps<typeof AttentionMark>, "label">) {
  if (count === 0) return null;
  return <AttentionMark count={count} label={needsYouLabel(count)} {...props} />;
}
