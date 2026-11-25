import type { QueryClient } from "@tanstack/react-query";
import { api, isNoIdentity } from "@upstream-dispatch/api/client";
import { askSignInAgain } from "@upstream-dispatch/api/query-client";
import {
  SIGN_OUT_SETTLE_MS,
  SignInChannel,
  type UnsentChange,
} from "@upstream-dispatch/features/shell/sign-in-channel";
import { type Write, writesOf } from "@upstream-dispatch/features/writes/write-store";

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

/** The question a sign-out asks while changes would be discarded. */
export function signOutQuestion(unsent: readonly string[], unanswered = false): string {
  const elsewhere = "any unsent changes in your other Dispatch tabs";
  if (unsent.length === 0) return `Sign out and discard ${elsewhere}?`;
  const count = unsent.length === 1 ? "1 unsent change" : `${unsent.length} unsent changes`;
  const what = unanswered ? `${count}, and ${elsewhere}` : count;
  return `Sign out and discard ${what}?\n\n${unsent.map((label) => `• ${label}`).join("\n")}`;
}

/** Settles the writes held for a tab that went while its sign-out was out: Dispatch decides. */
export async function heldWritesOfGoneHolder(
  queryClient: QueryClient,
  login: string
): Promise<void> {
  const writes = writesOf(queryClient);
  const held = writes.heldSignOut(login);
  const signedInNow = async () =>
    api.whoAmI().then(
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
