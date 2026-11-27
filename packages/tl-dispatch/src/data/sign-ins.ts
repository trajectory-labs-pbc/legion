import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { askSignInAgain, isNoIdentity } from "@/upstream/api";
import type { AuthenticatedUser } from "@/upstream/contract";
import {
  draftStoresSignedIn,
  draftStoresSignedOut,
  SIGN_OUT_SETTLE_MS,
  SignInChannel,
  type UnsentChange,
} from "@/upstream/data-hooks";
import { useEventFeed } from "@/upstream/live";
import { type Write, writesOf } from "@/upstream/writes";
import type { Read } from "./read";
import { askWhoIsSignedIn, forgetReads, sessionEnded } from "./session";

export type { UnsentChange } from "@/upstream/data-hooks";

// The channel name is upstream's, so tabs of either app hear each other.
export const signIns = new SignInChannel(
  typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel("dispatch-sign-in"),
  typeof window === "undefined" ? undefined : window,
  typeof navigator === "undefined" ? undefined : (navigator.locks ?? undefined)
);

/** The writes of `login` a sign-out would discard here. */
export function unsentChanges(rows: readonly Write[], login: string): UnsentChange[] {
  return rows
    .filter((row) => row.login === login && row.presentation !== "quiet" && row.status !== "made")
    .map((row) => ({ key: row.key, label: row.label }));
}

/** Settles the writes held for a tab that went while its sign-out was out: Dispatch decides. */
export async function heldWritesOfGoneHolder(
  queryClient: QueryClient,
  login: string
): Promise<void> {
  const writes = writesOf(queryClient);
  const held = writes.heldSignOut(login);
  const signedInNow = async () =>
    askWhoIsSignedIn().then(
      (user) => user.login,
      (error: unknown) => (isNoIdentity(error) ? null : login)
    );
  let who = await signedInNow();
  if (who === login) {
    const settled = Promise.withResolvers<void>();
    setTimeout(settled.resolve, SIGN_OUT_SETTLE_MS);
    await settled.promise;
    who = await signedInNow();
  }
  if (who === null) writes.dropLogin(login);
  else if (who === login) writes.releaseUnsettled(login, held);
  else writes.release(login, held);
  if (who !== login) void askSignInAgain(queryClient);
}

/**
 * Tells the write store, the draft stores and the other tabs who the session names, once it
 * answered, and drops every read made for a person whose session ended. Gives the login the shell
 * may be drawn for: it is set only in the commit after the stores were told of them.
 */
export function useSignedInStores(session: Read<AuthenticatedUser>): string | undefined {
  const queryClient = useQueryClient();
  const signedOut = sessionEnded(session);
  useEffect(() => {
    if (!signedOut) return;
    forgetReads(queryClient);
  }, [queryClient, signedOut]);
  // Listens before the signed-in effect below: a lapse that effect tells of can sign out.
  useEffect(
    () => writesOf(queryClient).onSignedOut((person) => draftStoresSignedOut(queryClient, person)),
    [queryClient]
  );
  const user = session.state === "ready" ? session.data : undefined;
  const login = signedOut ? undefined : user?.login;
  const known = signedOut || user !== undefined;
  const [shellFor, setShellFor] = useState<string>();
  useEffect(() => {
    if (!known) return;
    writesOf(queryClient).signedIn(login);
    draftStoresSignedIn(queryClient, login);
    signIns.signedIn(login ?? null);
    if (login !== undefined) setShellFor(login);
  }, [known, login, queryClient]);
  return shellFor;
}

/** Sends on, once, the writes of `login` a reload interrupted, then follows Dispatch's events. */
export function useSignedInFeed(login: string): void {
  const queryClient = useQueryClient();
  // Before any page writes.
  useEffect(() => {
    writesOf(queryClient).resume(login);
  }, [login, queryClient]);
  useEventFeed();
}

/** Lets the page leave for the sign-in with no question: its kept writes resume when it comes back. */
export function useLeaveToSignIn(): () => void {
  const queryClient = useQueryClient();
  return () => writesOf(queryClient).leavingToSignIn();
}
