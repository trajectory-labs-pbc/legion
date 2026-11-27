import type { UseQueryResult } from "@tanstack/react-query";
import type { ReadFault } from "./read";
import { useReadFailure } from "./read-failure";

/** A read the shell draws: none while it is out or after it failed, and the failure then. */
export interface ShellRead<T> {
  readonly data: T | undefined;
  readonly fault: ReadFault | undefined;
}

export function useShellRead<T>(query: UseQueryResult<T>): ShellRead<T> {
  return { data: query.data, fault: useReadFailure(query) };
}
