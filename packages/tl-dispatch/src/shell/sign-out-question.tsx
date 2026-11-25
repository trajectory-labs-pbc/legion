import { type ComponentProps, useEffect } from "react";

import { lazyOverlay } from "@/loading/lazy-region";

const load = () => import("./sign-out-question-view");
const Question = lazyOverlay("the sign-out question", load, "SignOutQuestionView");

/** The sign-out's question, drawn through its close; its code loads with the shell. */
export function SignOutQuestion(props: ComponentProps<typeof Question>) {
  useEffect(() => {
    // A failed load fails the open too, which shows it.
    void load().catch(() => undefined);
  }, []);
  return <Question {...props} />;
}
