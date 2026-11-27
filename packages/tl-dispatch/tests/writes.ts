import { QueryClient } from "@tanstack/react-query";
import { settle as letWritesRun } from "@upstream-dispatch/__tests__/fake-clock";
import type { WriteBounds } from "@upstream-dispatch/api/client";
import { whoAmIQuery } from "@upstream-dispatch/api/queries";
import { plainWrite, writesOf } from "@upstream-dispatch/features/writes/write-store";
import { act } from "react";

/** The person a test signs in. */
export const reader = { event_head: "0", kind: "user", login: "reader" } as const;

/** A query client whose sign-in check has named `reader`. */
export function signedInClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(whoAmIQuery().queryKey, reader);
  return client;
}

/**
 * Presses a status write as `reader`, which the sign-in check then names, and lets the store take
 * it up inside `act`. By default Dispatch never answers it; `write` replaces the attempt. Gives
 * back `outcome`, the press's answer or the error it ends with.
 */
export async function pressWrite(
  client: QueryClient,
  {
    label = "AB-1 set to done",
    write = () => new Promise<never>(() => {}),
  }: { label?: string; write?: (bounds: WriteBounds) => Promise<unknown> } = {}
): Promise<{ outcome: Promise<unknown> }> {
  client.setQueryData(whoAmIQuery().queryKey, reader);
  let outcome: Promise<unknown> = Promise.resolve();
  await act(async () => {
    outcome = writesOf(client)
      .run({
        detail: null,
        kind: plainWrite,
        label,
        method: "PATCH",
        presentation: "indicator",
        write,
      })
      .catch((error: unknown) => error);
    await letWritesRun();
  });
  return { outcome };
}
