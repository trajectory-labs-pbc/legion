import { useState } from "react";
import { signIns, type UnsentChange } from "@/data/sign-ins";
import { useSignOutWrite } from "@/data/sign-out";
import { writeFailureNote } from "@/data/write-failure-note";

function signOutFailure(error: Error): string {
  return writeFailureNote(error, {
    what: "the sign-out",
    anew: "Every change is still here. Retry ends your session, or finds it ended, and signs you out here.",
    refused: () => "The sign-out did not go through. You are still signed in, with every change.",
  });
}

/** The question a sign-out asks while changes would be discarded. */
function signOutQuestion(unsent: readonly string[], unanswered = false): string {
  const elsewhere = "any unsent changes in your other Dispatch tabs";
  if (unsent.length === 0) return `Sign out and discard ${elsewhere}?`;
  const count = unsent.length === 1 ? "1 unsent change" : `${unsent.length} unsent changes`;
  const what = unanswered ? `${count}, and ${elsewhere}` : count;
  return `Sign out and discard ${what}?\n\n${unsent.map((label) => `• ${label}`).join("\n")}`;
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
  const write = useSignOutWrite(login);
  const [askingTabs, setAskingTabs] = useState(false);
  const [question, setQuestion] = useState<{ text: string; open: boolean }>();
  const dismiss = () => setQuestion((asked) => asked && { ...asked, open: false });
  return {
    start: () => {
      if (askingTabs) return;
      setAskingTabs(true);
      void signIns.unsentElsewhere(login).then((elsewhere) => {
        setAskingTabs(false);
        const here = write.unsentHere();
        const unsent = unsentLabels(here, elsewhere.unsent);
        if (unsent.length > 0 || elsewhere.unanswered) {
          setQuestion({ text: signOutQuestion(unsent, elsewhere.unanswered), open: true });
        } else write.send();
      });
    },
    pending: write.pending || askingTabs,
    error: write.error === null ? undefined : signOutFailure(write.error),
    clearError: write.clearError,
    question: question?.text,
    asking: question?.open === true,
    confirm: () => {
      dismiss();
      write.send();
    },
    dismiss,
  };
}
