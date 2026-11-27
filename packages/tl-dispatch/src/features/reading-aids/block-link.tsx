import { textVariants } from "@legion/ui/lib/typography";
import { blockFragment } from "@upstream-dispatch/features/refs/block-reference";
import type { ReactNode } from "react";

const LINK = `min-w-0 underline-offset-2 hover:underline ${textVariants({ weight: "medium" })}`;

/** A link to a block of the document; a click calls `moveTo` in place of following it. */
export function BlockLink({
  blockId,
  children,
  moveTo,
  title,
}: {
  blockId: string;
  children: ReactNode;
  moveTo: (blockId: string) => void;
  title?: string;
}) {
  return (
    <a
      className={LINK}
      href={blockFragment(blockId)}
      onClick={(event) => {
        event.preventDefault();
        moveTo(blockId);
      }}
      title={title}
    >
      {children}
    </a>
  );
}
