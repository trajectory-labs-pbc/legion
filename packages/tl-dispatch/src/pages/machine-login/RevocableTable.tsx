import type { UseQueryResult } from "@tanstack/react-query";
import { apiErrorMessage, type WriteBounds } from "@upstream-dispatch/api/client";
import { useKeyedWrite } from "@upstream-dispatch/features/writes/useKeyedWrite";
import { useSubmitGuard } from "@upstream-dispatch/hooks/useSubmitGuard";
import type { ReactNode } from "react";

import { Button } from "../../ui/button";

export interface RevocableColumn<Row> {
  cell: (row: Row) => ReactNode;
  header: string;
}

/** A list of things the viewer may revoke: one row each, a Revoke button, and a refusal under it. */
export function RevocableTable<Row>({
  columns,
  confirm,
  description,
  empty,
  heading,
  headingId,
  noun,
  onRevoked,
  query,
  revoke,
  revokeError,
  rowKey,
  unrevocable,
}: {
  columns: readonly RevocableColumn<Row>[];
  confirm?: (row: Row) => string;
  description: ReactNode;
  empty: string;
  heading: string;
  headingId: string;
  noun: string;
  onRevoked: () => void;
  query: UseQueryResult<readonly Row[]>;
  revoke: (row: Row, bounds: WriteBounds) => Promise<void>;
  revokeError: string;
  rowKey: (row: Row) => string;
  unrevocable?: (row: Row) => string | null;
}): ReactNode {
  const submitGuard = useSubmitGuard();
  const mutation = useKeyedWrite({
    method: "POST",
    inline: true,
    label: (row: Row) => `${heading}: revoke ${rowKey(row)}`,
    onSettled: () => submitGuard.release(),
    onSuccess: onRevoked,
    write: revoke,
  });
  const press = (row: Row) => {
    if (confirm === undefined || window.confirm(confirm(row))) {
      submitGuard.guard(() => mutation.mutate(row));
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground" id={headingId}>
          {heading}
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
      </div>

      {query.isPending ? <p className="text-sm text-muted-foreground">Loading {noun}…</p> : null}
      {query.isError ? (
        <div className="flex items-center gap-3 border border-border bg-card p-3 text-sm">
          <span className="text-destructive">Couldn't load {noun}.</span>
          <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {query.isSuccess ? (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th className="px-4 py-2 font-medium" key={column.header} scope="col">
                    {column.header}
                  </th>
                ))}
                <th className="px-4 py-2" scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={columns.length + 1}>
                    {empty}
                  </td>
                </tr>
              ) : (
                query.data.map((row) => (
                  <tr
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                    key={rowKey(row)}
                  >
                    {columns.map((column, index) => (
                      <td
                        className={
                          index === 0
                            ? "px-4 py-2 font-medium text-foreground"
                            : "px-4 py-2 text-muted-foreground"
                        }
                        key={column.header}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      {unrevocable?.(row) ? (
                        <span className="text-xs whitespace-nowrap text-muted-foreground">
                          {unrevocable(row)}
                        </span>
                      ) : (
                        <Button
                          disabled={mutation.isPending}
                          onClick={() => press(row)}
                          variant="danger"
                        >
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      {mutation.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(mutation.error, revokeError)}</p>
      ) : null}
    </section>
  );
}
