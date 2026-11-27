import type { UseQueryResult } from "@tanstack/react-query";
import { readFailureOf } from "@/features/read-failure";
import type { RetryableFault } from "./read";

/** A read the shell draws: none while it is out or after it failed, and the failure then. */
export interface ShellRead<T> {
  readonly data: T | undefined;
  readonly fault: RetryableFault | undefined;
}

export function shellRead<T>(query: UseQueryResult<T>): ShellRead<T> {
  return { data: query.data, fault: readFailureOf(query) };
}
