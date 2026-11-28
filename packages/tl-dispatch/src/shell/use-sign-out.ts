import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, isNoIdentity } from "@/upstream/api";
import type { UnsentChange } from "@/upstream/data-hooks";
import { useKeyedWrite, useRefusalOfSubject, writesOf } from "@/upstream/writes";

import { writeFailureNote } from "@/writes/write-failure-note";
import { forgetReads } from "./forget-reads";
import { signIns, signOutQuestion, unsentChanges } from "./sign-ins";

function signOutFailure(error: Error): string {
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
  /** Puts the refusal away; the session stays. */
  clearError: () => void;
  /** The question asked before changes are discarded; kept while it closes. */
  question: string | undefined;
  /** The question is open. */
  asking: boolean;
  /** Answers the question with Sign out. */
  confirm: () => void;
  /** Closes the question; the session stays. */
  dismiss: () => void;
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
  const [question, setQuestion] = useState<{ text: string; open: boolean }>();
  const send = () => {
    signIns.signingOut(login);
    write.mutate(login);
  };
  const dismiss = () => setQuestion((asked) => asked && { ...asked, open: false });
  return {
    start: () => {
      if (askingTabs) return;
      setAskingTabs(true);
      void signIns.unsentElsewhere(login).then((elsewhere) => {
        setAskingTabs(false);
        const here = unsentChanges(writesOf(queryClient).rows(), login);
        const unsent = unsentLabels(here, elsewhere.unsent);
        if (unsent.length > 0 || elsewhere.unanswered) {
          setQuestion({ text: signOutQuestion(unsent, elsewhere.unanswered), open: true });
        } else send();
      });
    },
    pending: write.isPending || askingTabs,
    error: refused && write.error !== null ? signOutFailure(write.error) : undefined,
    clearError: write.reset,
    question: question?.text,
    asking: question?.open === true,
    confirm: () => {
      dismiss();
      send();
    },
    dismiss,
  };
}
