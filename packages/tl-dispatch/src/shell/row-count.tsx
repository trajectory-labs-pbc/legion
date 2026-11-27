import { Button } from "@legion/ui/components/button";
import { Count } from "@legion/ui/components/count";
import { CircleAlertIcon } from "lucide-react";
import { LabelTooltip } from "@/commands/hotkey-tooltip";
import type { ReadFault } from "@/data/read";
import { NeedsYouMark } from "@/parts/needs-you";

/** A count beside a row; none at zero. */
export interface RowCount {
  /** None until every read it needs has answered. */
  count: number | undefined;
  /** What it counts waits on the reader, so it takes the "needs you" mark. */
  needsYou?: boolean;
  /** Names the count on hover where no key tooltip names its row. */
  label?: string;
  /** A read it needs failed with nothing to show. */
  fault?: ReadFault;
}

/** A row's count: what waits on the reader in the mark, else a muted number; none if it failed. */
export function RowCountMark({
  className,
  count,
}: {
  className?: string;
  count: RowCount | undefined;
}) {
  if (count?.fault !== undefined) return null;
  const value = count?.count ?? 0;
  return count?.needsYou ? (
    <NeedsYouMark className={className} count={value} />
  ) : (
    <Count className={className} value={value} />
  );
}

/**
 * A failed count in its own box: a danger icon whose tooltip says so, and whose click retries.
 * A refused count draws nothing, as asking again cannot change it; the row's page says why.
 */
export function CountRetry({
  className,
  fault,
  noun,
}: {
  className?: string;
  fault: ReadFault;
  noun: string;
}) {
  if (fault.refusal !== undefined) return null;
  const label = `Could not load ${noun}. Retry`;
  return (
    <LabelTooltip label={label} side="right">
      <Button
        aria-label={label}
        className={className}
        loading={fault.retrying}
        onClick={fault.retry}
        size="icon-sm"
        variant="quiet-danger"
      >
        <CircleAlertIcon aria-hidden />
      </Button>
    </LabelTooltip>
  );
}
