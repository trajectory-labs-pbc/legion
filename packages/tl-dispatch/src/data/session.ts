import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { api, isUnauthorized } from "@/upstream/api";
import type { AuthenticatedUser } from "@/upstream/contract";
import { whoAmIQuery } from "@/upstream/queries";
import { type Read, useRead } from "./read";

export type { AuthenticatedUser } from "@/upstream/contract";

/** The cache key of the signed-in person. */
export const sessionKey = whoAmIQuery().queryKey;

/** The signed-in person, as a read: a 401 `error` is the signed-out case. */
export function useSession() {
  return useRead(whoAmIQuery());
}

/** Asks who is signed in again, for a Retry of a read made with the session. */
export function useAskSessionAgain(): () => void {
  const client = useQueryClient();
  return () => void client.refetchQueries({ queryKey: sessionKey, exact: true });
}

/** Whether a person is signed in, as upstream's `useIsHuman` answers: the reads only a person
 *  makes wait for it. */
export function isPerson(session: Read<AuthenticatedUser>): boolean {
  return session.state === "ready" && session.data.kind === "user";
}

/** The session ended: Dispatch answered the read of who is signed in with a 401. */
export function sessionEnded(session: Read<AuthenticatedUser>): boolean {
  if (session.state === "error") return isUnauthorized(session.error);
  return session.state === "ready" && isUnauthorized(session.refreshError);
}

/** Who Dispatch says is signed in now, asked outside the shared read. */
export function askWhoIsSignedIn(): Promise<AuthenticatedUser> {
  return api.whoAmI();
}

/** Drops every read made for the person who left; the session stays, to say who is here now. */
export function forgetReads(client: QueryClient): void {
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
}

/** Reads who is signed in again from nothing, as a sign-out does. */
export function resetSession(client: QueryClient): void {
  void client.resetQueries({ queryKey: sessionKey });
}
