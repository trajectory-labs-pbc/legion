import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Button } from "@/ui/button";
import { Heading } from "@/ui/heading";
import { writeFailureNote } from "@/writes/write-failure-note";
import {
  refusedNote,
  useKeyedWrite,
  useRefusalOfSubject,
  useSubmitGuard,
  type WriteBounds,
} from "./upstream";

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
  rowKey,
  rowName,
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
  rowKey: (row: Row) => string;
  /** `row` as the refusal line names it: `the machine login for devbox`. */
  rowName: (row: Row) => string;
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
  // The refusal line goes once its row leaves the list.
  const refused = useRefusalOfSubject(
    mutation,
    (row) => query.data?.some((listed) => rowKey(listed) === rowKey(row)) === true
  )
    ? mutation.variables
    : undefined;
  const press = (row: Row) => {
    if (confirm === undefined || window.confirm(confirm(row))) {
      submitGuard.guard(() => mutation.mutate(row));
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <Heading id={headingId} size="section">
          {heading}
        </Heading>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">{description}</p>
      </div>

      {query.isPending ? <p className="text-sm text-muted-foreground">Loading {noun}…</p> : null}
      {query.isError ? (
        <div
          className="flex items-center gap-3 border border-border bg-card p-3 text-sm"
          role="alert"
        >
          <span className="text-destructive">Couldn't load {noun}.</span>
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            size="sm"
            variant="outline"
          >
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
                          aria-label={`Revoke ${rowName(row)}`}
                          disabled={mutation.isPending}
                          onClick={() => press(row)}
                          size="sm"
                          variant="destructive"
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
      {refused === undefined ? null : (
        <p className="text-sm text-destructive">
          {writeFailureNote(mutation.error, {
            what: `the revoke of ${rowName(refused)}`,
            anew: "Pressing Revoke again sends a new revoke.",
            refused: (error) => refusedNote(`revoke ${rowName(refused)}`, error),
          })}
        </p>
      )}
    </section>
  );
}
