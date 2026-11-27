import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { sessionKey } from "@/data/session";
import type { WriteBounds } from "@/upstream/api";
import { plainWrite, writesOf } from "@/upstream/writes";
import { settle as letWritesRun } from "./upstream";

/** The person a test signs in. */
export const reader = { event_head: "0", kind: "user", login: "reader" } as const;

/** A query client whose sign-in check has named `reader`. */
export function signedInClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(sessionKey, reader);
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
  client.setQueryData(sessionKey, reader);
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
