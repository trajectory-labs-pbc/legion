import type { QueryClient } from "@tanstack/react-query";

/** Drops every read made for the person who left; `whoami` stays, to say who is here now. */
export function forgetReads(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== "whoami" });
}
