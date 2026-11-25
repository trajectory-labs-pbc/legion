import { Count } from "@legion/ui/components/count";
import { NeedsYouMark } from "@/features/needs-you";

/** A count beside a row; none at zero. */
export interface RowCount {
  /** None until every read it needs has answered. */
  count: number | undefined;
  /** What it counts waits on the reader, so it takes the "needs you" mark. */
  needsYou?: boolean;
  /** Names the count on hover where no key tooltip names its row. */
  label?: string;
  /** A read it needs failed with nothing to show: asks every one of them again. */
  retry?: () => void;
}

/** A row's count: what waits on the reader in the mark, else a muted number. */
export function RowCountMark({
  className,
  count,
  title,
}: {
  className?: string;
  count: RowCount | undefined;
  title?: string;
}) {
  const value = count?.count ?? 0;
  return count?.needsYou ? (
    <NeedsYouMark className={className} count={value} title={title} />
  ) : (
    <Count className={className} title={title} value={value} />
  );
}
