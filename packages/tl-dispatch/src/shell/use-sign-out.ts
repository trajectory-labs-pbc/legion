import { useQueryClient } from "@tanstack/react-query";
import { api, isNoIdentity } from "@upstream-dispatch/api/client";
import type { UnsentChange } from "@upstream-dispatch/features/shell/sign-in-channel";
import {
  useKeyedWrite,
  useRefusalOfSubject,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import { useState } from "react";

import { writeFailureNote } from "@/writes/write-failure-note";
import { forgetReads } from "./forget-reads";
import { signIns, signOutQuestion, unsentChanges } from "./sign-ins";

export function signOutFailure(error: Error): string {
  return writeFailureNote(error, {
    what: "the sign-out",
    anew: "Every change is still here. Retry ends your session, or finds it ended, and signs you out here.",
    refused: () => "The sign-out did not go through. You are still signed in, with every change.",
  });
}

/** The labels of the changes a sign-out would discard, each once, this tab's first. */
export function unsentLabels(
  here: readonly UnsentChange[],
  elsewhere: readonly UnsentChange[]
): string[] {
  const labels = new Map<string, string>();
  for (const { key, label } of [...here, ...elsewhere]) {
    if (!labels.has(key)) labels.set(key, label);
  }
  return [...labels.values()];
}

export interface SignOut {
  start: () => void;
  pending: boolean;
  /** Why the last sign-out failed, while it is this person's. */
  error: string | undefined;
}

/** Signs `login` out, asking first while this tab or another holds unsent changes. */
export function useSignOut(login: string): SignOut {
  const queryClient = useQueryClient();
  const write = useKeyedWrite({
    endsWithSession: true,
    inline: true,
    keyed: false,
    label: (_signingOut: string) => "Sign out",
    onError: (_error, signingOut) => signIns.stillSignedIn(signingOut),
    onSuccess: (_answer, signingOut) => {
      void queryClient.resetQueries({ queryKey: ["whoami"] });
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
  const [askingTabs, setAskingTabs] = useState(false);
  return {
    start: () => {
      if (askingTabs) return;
      setAskingTabs(true);
      void signIns.unsentElsewhere(login).then((elsewhere) => {
        setAskingTabs(false);
        const here = unsentChanges(writesOf(queryClient).rows(), login);
        const unsent = unsentLabels(here, elsewhere.unsent);
        const ask = unsent.length > 0 || elsewhere.unanswered;
        if (ask && !window.confirm(signOutQuestion(unsent, elsewhere.unanswered))) return;
        signIns.signingOut(login);
        write.mutate(login);
      });
    },
    pending: write.isPending || askingTabs,
    error: refused && write.error !== null ? signOutFailure(write.error) : undefined,
  };
}
