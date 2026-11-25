import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Button } from "@legion/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@legion/ui/components/collapsible";
import { Heading } from "@legion/ui/components/heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@legion/ui/components/table";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { writeFailureNote } from "@/writes/write-failure-note";
import { refusedNote } from "./upstream";
import type { Revoke } from "./use-revoke";

export interface RevocableColumn<Row> {
  cell: (row: Row) => ReactNode;
  header: string;
}

/** A list of things the viewer may revoke: one row each, a Revoke button, and a refusal under it. */
export function RevocableTable<Row>({
  columns,
  description,
  empty,
  heading,
  headingId,
  noun,
  query,
  revoke,
  rowKey,
  rowName,
}: {
  columns: readonly RevocableColumn<Row>[];
  description: ReactNode;
  empty: string;
  heading: string;
  headingId: string;
  noun: string;
  query: UseQueryResult<readonly Row[]>;
  revoke: Revoke<Row>;
  rowKey: (row: Row) => string;
  /** `row` as the refusal line names it: `the machine login for devbox`. */
  rowName: (row: Row) => string;
}): ReactNode {
  const { refused } = revoke;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <Heading id={headingId} size="section">
          {heading}
        </Heading>
        <Collapsible>
          <CollapsibleTrigger
            render={<Button className="px-0 underline" size="sm" variant="link" />}
          >
            How {noun} work
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="text-sm text-pretty text-muted-foreground">{description}</p>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading {noun}…</p>
      ) : query.isError ? (
        <Alert variant="danger">
          <AlertTitle>Couldn't load {noun}.</AlertTitle>
          <AlertAction>
            <Button
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : (
        <div className="border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.header} scope="col">
                    {column.header}
                  </TableHead>
                ))}
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data === undefined || query.data.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={columns.length + 1}>
                    {empty}
                  </TableCell>
                </TableRow>
              ) : (
                query.data.map((row) => (
                  <TableRow key={rowKey(row)}>
                    {columns.map((column, index) => (
                      <TableCell
                        className={index === 0 ? "font-medium" : "text-muted-foreground"}
                        key={column.header}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <Button
                        aria-label={`Revoke ${rowName(row)}`}
                        disabled={revoke.pending}
                        onClick={() => revoke.press(row)}
                        size="sm"
                        variant="quiet-danger"
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {refused === undefined ? null : (
        <p className="text-sm text-danger">
          {writeFailureNote(revoke.error, {
            what: `the revoke of ${rowName(refused)}`,
            anew: "Pressing Revoke again sends a new revoke.",
            refused: (error) => refusedNote(`revoke ${rowName(refused)}`, error),
          })}
        </p>
      )}
    </section>
  );
}
