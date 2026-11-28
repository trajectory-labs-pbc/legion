import { useQueryClient } from "@tanstack/react-query";
import { api, isNoIdentity } from "@/upstream/api";
import type { UnsentChange } from "@/upstream/data-hooks";
import { useKeyedWrite, useRefusalOfSubject, writesOf } from "@/upstream/writes";
import { forgetReads, resetSession } from "./session";
import { signIns, unsentChanges } from "./sign-ins";

export interface SignOutWrite {
  /** Ends the session of `login`, and tells the other tabs first. */
  send: () => void;
  pending: boolean;
  /** Why the last sign-out failed, while it is this person's. */
  error: Error | null;
  /** Puts the refusal away; the session stays. */
  clearError: () => void;
  /** The changes of `login` this tab would discard. */
  unsentHere: () => UnsentChange[];
}

/** The write that signs `login` out; once it goes through, every read but who is here goes. */
export function useSignOutWrite(login: string): SignOutWrite {
  const queryClient = useQueryClient();
  const write = useKeyedWrite({
    endsWithSession: true,
    inline: true,
    keyed: false,
    label: (_signingOut: string) => "Sign out",
    onError: (_error, signingOut) => signIns.stillSignedIn(signingOut),
    onSuccess: (_answer, signingOut) => {
      resetSession(queryClient);
      forgetReads(queryClient);
      writesOf(queryClient).signedOut(signingOut);
      signIns.signedOut(signingOut);
    },
    method: "POST",
    write: () =>
      api
        .logout()
        .catch((error: unknown) =>
          isNoIdentity(error) ? { ok: true as const } : Promise.reject(error)
        ),
  });
  // A refusal belongs to the person who pressed sign-out.
  const refused = useRefusalOfSubject(write, (signingOut) => signingOut === login);
  return {
    send: () => {
      signIns.signingOut(login);
      write.mutate(login);
    },
    pending: write.isPending,
    error: refused ? write.error : null,
    clearError: write.reset,
    unsentHere: () => unsentChanges(writesOf(queryClient).rows(), login),
  };
}
