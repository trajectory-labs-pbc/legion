import type { QueryKey, UseQueryResult } from "@tanstack/react-query";
import type { ReadFault } from "./read";
import { useReadFailure } from "./read-failure";

/** A read the shell draws: none while it is out or after it failed, and the failure then. */
export interface ShellRead<T> {
  readonly data: T | undefined;
  readonly fault: ReadFault | undefined;
}

/** `read` of the query under `key`, as the shell draws it. */
export function useShellRead<T>(read: UseQueryResult<T>, key: QueryKey): ShellRead<T> {
  return { data: read.data, fault: useReadFailure({ read, key }) };
}
